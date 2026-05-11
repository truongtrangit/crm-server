/**
 * BlockAutomationExecutor
 *
 * Resolves a BlockAutomation's payloadTemplate with data from an Event,
 * then sends the HTTP request to the third-party API.
 *
 * Template syntax: {{fieldPath}} where fieldPath uses dot-notation
 * to access nested fields in the Event document.
 * E.g.  {{customer.email}}  →  event.customer.email
 *       {{plan.daysLeft}}   →  event.plan.daysLeft
 */

const BlockAutomation = require("../models/BlockAutomation");
const Action = require("../models/Action");
const Event = require("../models/Event");
const Lead = require("../models/Lead");
const Task = require("../models/Task");
const { createHttpError } = require("../utils/http");
const logger = require("../utils/logger");

// ─── Helpers ───

/**
 * Safely get a nested value from an object using dot-notation path.
 * e.g. getNestedValue({ a: { b: 3 } }, "a.b") → 3
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null) return undefined;
    // Support array index  e.g. "services.0.name"
    current = current[key];
  }
  return current;
}

/**
 * Resolve all {{fieldPath}} placeholders in a JSON template string
 * by extracting values from the event data.
 */
function resolveTemplate(templateString, eventData) {
  return templateString.replace(/\{\{([^}]+)\}\}/g, (_match, fieldPath) => {
    const trimmedPath = fieldPath.trim();
    const value = getNestedValue(eventData, trimmedPath);
    if (value === undefined || value === null) return "";
    // If value is an object/array, stringify it (so nested JSON stays valid)
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

// ─── Main executor ───

/**
 * Execute a block automation for a given event + action step.
 *
 * @param {string} eventId    - The Event ID to pull data from
 * @param {string} actionId   - The Action ID (which has blockAutomationId)
 * @param {string} entityType - "event" or "task" (defaults to "event")
 * @returns {object} { success, status, responseData, error }
 */
async function executeBlockAutomation(eventId, actionId, entityType = "event") {
  // 1. Load Action → get blockAutomationId
  const action = await Action.findOne({ id: actionId }).lean();
  if (!action) throw createHttpError(404, "Action không tồn tại");
  if (action.type !== "send_block_automation") {
    throw createHttpError(400, "Action này không phải loại Block Automation");
  }
  if (!action.blockAutomationId) {
    throw createHttpError(400, "Action chưa được liên kết với Block Automation nào");
  }

  // 2. Load BlockAutomation config
  const blockAuto = await BlockAutomation.findOne({ id: action.blockAutomationId }).lean();
  if (!blockAuto) throw createHttpError(404, `Block Automation "${action.blockAutomationId}" không tồn tại`);
  if (!blockAuto.isActive) {
    throw createHttpError(400, `Block Automation "${blockAuto.name}" đã bị tắt`);
  }

  // 3. Load entity data
  let entityData = null;
  if (entityType === "task") {
    const task = await Task.findOne({ id: eventId }).lean();
    if (!task) throw createHttpError(404, `Task "${eventId}" không tồn tại`);

    // Dynamically extract context from associated Leads or Events
    let leadData = null;
    let eventData = null;

    if (task.linkedLeads && task.linkedLeads.length > 0) {
      leadData = await Lead.findOne({ id: task.linkedLeads[0].leadId }).lean();
    }
    if (task.linkedEvents && task.linkedEvents.length > 0) {
      eventData = await Event.findOne({ id: task.linkedEvents[0].eventId }).lean();
    }

    if (leadData || eventData) {
      entityData = { ...task };
      if (leadData) {
        Object.assign(entityData, leadData);
        entityData.lead = leadData; // accessible via {{lead.field}}
      }
      if (eventData) {
        Object.assign(entityData, eventData);
        entityData.event = eventData; // accessible via {{event.field}}
      }
    } else {
      // Fallback to task if no linked entity exists
      entityData = task;
    }
  } else {
    entityData = await Event.findOne({ id: eventId }).lean();
    if (!entityData) throw createHttpError(404, `Event "${eventId}" không tồn tại`);
  }

  // 4. Resolve payload template
  const rawTemplate = blockAuto.payloadTemplate || "{}";
  const resolvedString = resolveTemplate(rawTemplate, entityData);

  let resolvedPayload;
  try {
    resolvedPayload = JSON.parse(resolvedString);
  } catch (parseErr) {
    throw createHttpError(
      500,
      `Payload template sau khi resolve không hợp lệ JSON: ${parseErr.message}\nResolved string: ${resolvedString}`
    );
  }

  // 5. Call third-party API
  const { url, authToken, method } = blockAuto;
  const httpMethod = (method || "POST").toUpperCase();

  const headers = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const fetchOptions = {
    method: httpMethod,
    headers,
  };

  // GET / DELETE usually don't have body
  if (!["GET", "DELETE", "HEAD"].includes(httpMethod)) {
    fetchOptions.body = JSON.stringify(resolvedPayload);
  }

  logger.info("[BlockAutomation] Calling third-party API", {
    blockAutomation: blockAuto.name,
    method: httpMethod,
    url,
    eventId,
    actionId,
    payloadPreview: JSON.stringify(resolvedPayload).substring(0, 300),
  });

  try {
    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get("content-type") || "";
    let responseData;
    let responseText = "";
    try {
      responseText = await response.text();
      if (contentType.includes("application/json")) {
        responseData = JSON.parse(responseText);
      } else {
        responseData = responseText;
      }
    } catch {
      responseData = responseText || null;
    }

    // Extract useful error info from response
    let errorDetail = null;
    if (!response.ok) {
      const parts = [`HTTP ${response.status} ${response.statusText}`];

      // Try to extract error message from common JSON patterns
      if (responseData && typeof responseData === "object") {
        const msg =
          responseData.message ||
          responseData.error?.message ||
          responseData.error ||
          responseData.detail ||
          responseData.errors ||
          responseData.msg ||
          responseData.reason;
        if (msg) {
          parts.push(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
      } else if (typeof responseData === "string" && responseData.length > 0 && responseData.length < 500) {
        parts.push(responseData);
      }

      errorDetail = parts.join(" — ");
    }

    if (response.ok) {
      logger.info("[BlockAutomation] API call succeeded", {
        blockAutomation: blockAuto.name,
        status: response.status,
        url,
      });
    } else {
      logger.error("[BlockAutomation] API call failed", {
        blockAutomation: blockAuto.name,
        status: response.status,
        statusText: response.statusText,
        url,
        error: errorDetail,
        responseBody: typeof responseData === "object"
          ? JSON.stringify(responseData).substring(0, 500)
          : String(responseData || "").substring(0, 500),
        responseHeaders: {
          contentType,
          date: response.headers.get("date"),
          requestId: response.headers.get("x-request-id") || response.headers.get("x-trace-id") || null,
        },
      });
    }

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      blockAutomationName: blockAuto.name,
      url,
      method: httpMethod,
      resolvedPayload,
      responseData,
      responseHeaders: {
        contentType: contentType,
        date: response.headers.get("date"),
        requestId: response.headers.get("x-request-id") || response.headers.get("x-trace-id") || null,
      },
      error: errorDetail,
    };
  } catch (fetchErr) {
    // Network errors: DNS, timeout, connection refused, etc.
    const isTimeout = fetchErr.name === "AbortError" || fetchErr.code === "UND_ERR_CONNECT_TIMEOUT";
    const errorMessage = isTimeout
      ? `Timeout kết nối tới ${url}`
      : `Lỗi kết nối: ${fetchErr.message || fetchErr.code || "Unknown"}`;

    logger.error("[BlockAutomation] Network error calling API", {
      blockAutomation: blockAuto.name,
      url,
      method: httpMethod,
      errorName: fetchErr.name,
      errorCode: fetchErr.code,
      errorMessage: fetchErr.message,
    });

    return {
      success: false,
      status: null,
      statusText: null,
      blockAutomationName: blockAuto.name,
      url,
      method: httpMethod,
      resolvedPayload,
      responseData: null,
      responseHeaders: null,
      error: errorMessage,
    };
  }
}

module.exports = {
  resolveTemplate,
  getNestedValue,
  executeBlockAutomation,
};
