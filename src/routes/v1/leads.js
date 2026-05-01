const express = require("express");
const Lead = require("../../models/Lead");
const { generateMonotonicId } = require("../../utils/id");
const { buildSearchRegex } = require("../../utils/query");
const { sendError, sendSuccess } = require("../../utils/http");
const {
  buildPaginatedResponse,
  resolvePagination,
} = require("../../utils/pagination");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const {
  createLeadSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
  listLeadsQuerySchema,
} = require("../../validations/leads");
const SystemLogService = require("../../services/SystemLogService");
const { computeChanges } = require("../../utils/diff");

const router = express.Router();

router.get(
  "/",
  requirePermission(PERMISSIONS.LEADS_READ),
  validate(listLeadsQuerySchema, "query"),
  async (req, res) => {
    const { search = "", status, assignee } = req.query;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(req.query || {});
    const query = {};

    if (searchRegex) {
      query.$or = [
        { name: searchRegex },
        { id: searchRegex },
        { tags: searchRegex },
      ];
    }

    if (status) {
      query.status = status;
    }

    if (assignee) {
      query["assignee.name"] = assignee;
    }

    const [leads, totalItems] = await Promise.all([
      Lead.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Lead.countDocuments(query),
    ]);

    return sendSuccess(
      res,
      200,
      "Get lead list success",
      buildPaginatedResponse(leads, totalItems, page, limit),
    );
  },
);

router.post(
  "/",
  requirePermission(PERMISSIONS.LEADS_CREATE),
  validate(createLeadSchema),
  async (req, res) => {
    const payload = req.body || {};

    const lead = await Lead.create({
      id: await generateMonotonicId("LEAD"),
      name: payload.name,
      avatar:
        payload.avatar ||
        `https://i.pravatar.cc/150?u=${encodeURIComponent(payload.name)}`,
      timeAgo: payload.timeAgo || "Vừa xong",
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      assignee: payload.assignee || { name: "", avatar: "" },
      status: payload.status || "Biz tạo mới",
      actionNeeded: payload.actionNeeded || "",
      actionType: payload.actionType || "",
      email: payload.email || "",
      phone: payload.phone || "",
      source: payload.source || "",
      address: payload.address || "",
    });

    SystemLogService.log({ action: "create", resource: RESOURCES.LEADS, resourceId: lead.id, resourceName: lead.name, description: `Tạo cơ hội "${lead.name}"`, req });
    return sendSuccess(res, 201, "Create lead success", lead);
  },
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.LEADS_UPDATE),
  validate(updateLeadSchema),
  async (req, res) => {
    const lead = await Lead.findOne({ id: req.params.id });
    if (!lead) {
      return sendError(res, 404, "Lead not found", {
        code: "LEAD_NOT_FOUND",
      });
    }

    const oldState = lead.toObject();

    Object.assign(lead, {
      name: req.body.name ?? lead.name,
      avatar: req.body.avatar ?? lead.avatar,
      timeAgo: req.body.timeAgo ?? lead.timeAgo,
      tags: Array.isArray(req.body.tags) ? req.body.tags : lead.tags,
      assignee: req.body.assignee ?? lead.assignee,
      status: req.body.status ?? lead.status,
      actionNeeded: req.body.actionNeeded ?? lead.actionNeeded,
      actionType: req.body.actionType ?? lead.actionType,
      email: req.body.email ?? lead.email,
      phone: req.body.phone ?? lead.phone,
      source: req.body.source ?? lead.source,
      address: req.body.address ?? lead.address,
    });

    await lead.save();
    
    const newState = lead.toObject();
    const changes = computeChanges(oldState, newState, ["name", "avatar", "timeAgo", "tags", "assignee", "status", "actionNeeded", "actionType", "email", "phone", "source", "address"]);
    SystemLogService.log({ action: "update", resource: RESOURCES.LEADS, resourceId: lead.id, resourceName: lead.name, description: `Cập nhật cơ hội "${lead.name}"`, metadata: { changes }, req });

    return sendSuccess(res, 200, "Update lead success", lead);
  },
);

router.patch(
  "/:id/status",
  requirePermission(PERMISSIONS.LEADS_UPDATE),
  validate(updateLeadStatusSchema),
  async (req, res) => {
    const lead = await Lead.findOne({ id: req.params.id });

    if (!lead) {
      return sendError(res, 404, "Lead not found", {
        code: "LEAD_NOT_FOUND",
      });
    }

    const oldState = lead.toObject();
    lead.status = req.body.status;
    await lead.save();

    const newState = lead.toObject();
    const changes = computeChanges(oldState, newState, ["status"]);
    SystemLogService.log({ action: "update", resource: RESOURCES.LEADS, resourceId: lead.id, resourceName: lead.name, description: `Cập nhật trạng thái cơ hội "${lead.name}"`, metadata: { changes }, req });

    return sendSuccess(res, 200, "Update lead status success", lead);
  },
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.LEADS_DELETE),
  async (req, res) => {
    const lead = await Lead.findOne({ id: req.params.id });

    if (!lead) {
      return sendError(res, 404, "Lead not found", {
        code: "LEAD_NOT_FOUND",
      });
    }

    await lead.softDelete();
    SystemLogService.log({ action: "delete", resource: RESOURCES.LEADS, resourceId: lead.id, description: `Xóa cơ hội ${lead.id}`, req });
    return sendSuccess(res, 200, "Delete lead success", null);
  },
);

module.exports = router;
