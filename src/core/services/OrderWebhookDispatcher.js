const logger = require('../utils/logger');
const httpClient = require('../utils/httpClient');
const {
  ORDER_WEBHOOK_EVENTS,
  ORDER_WEBHOOK_SCOPE_TYPES,
  ORDER_WEBHOOK_DELIVERY_STATUSES,
  COURSE_TYPES,
} = require('../constants/appData');

/**
 * OrderWebhookDispatcher — Fire-and-forget webhook dispatch
 * khi checkout đơn hàng thành công.
 *
 * Resolve rules theo priority: Specific > CourseType > Global
 * Cùng priority → gửi tất cả.
 */
class OrderWebhookDispatcher {
  /**
   * Dispatch webhooks sau khi checkout thành công.
   * Fire-and-forget — KHÔNG block checkout flow.
   *
   * @param {Array} enrollments - enrollmentsToCreate từ checkout
   * @param {Map} courseMap - Map courseId → course object
   * @param {Object} customer - customer object (name, email, phone, id)
   * @param {string} transactionGroupId - ID nhóm giao dịch
   */
  dispatch(enrollments, courseMap, customer, transactionGroupId) {
    // Fire-and-forget: dùng setImmediate để không block event loop hiện tại
    setImmediate(() => {
      this._execute(enrollments, courseMap, customer, transactionGroupId)
        .catch((err) => {
          logger.error('OrderWebhookDispatcher: unhandled error', {
            error: err.message,
            stack: err.stack,
          });
        });
    });
  }

  async _execute(enrollments, courseMap, customer, transactionGroupId) {
    // Lazy load model để tránh circular dependency
    const OrderWebhookRule = require('../../modules/course/orderWebhook/orderWebhookRule.model');
    const OrderWebhookDeliveryLog = require('../../modules/course/orderWebhook/orderWebhookDeliveryLog.model');

    // Lấy tất cả active rules match event completed
    const activeRules = await OrderWebhookRule.find({
      events: ORDER_WEBHOOK_EVENTS.COMPLETED,
      isActive: true,
    }).lean();

    if (!activeRules.length) return;

    for (const enrollment of enrollments) {
      const course = courseMap.get(enrollment.courseId);
      if (!course) continue;

      // Resolve rules theo priority
      const matchedRules = this._resolveRules(activeRules, enrollment, course);
      if (!matchedRules.length) continue;

      // Build payload
      const payload = this._buildPayload(enrollment, course, customer, transactionGroupId);

      // Gửi HTTP POST đến từng matched rule
      const results = await Promise.allSettled(
        matchedRules.map((rule) => this._sendWebhook(rule, payload)),
      );

      // Log delivery cho từng rule
      for (let i = 0; i < matchedRules.length; i++) {
        const rule = matchedRules[i];
        const result = results[i];
        const logEntry = this._buildLogEntry(
          rule,
          payload,
          enrollment,
          course,
          result,
        );

        try {
          await OrderWebhookDeliveryLog.create(logEntry);
        } catch (logErr) {
          logger.error('OrderWebhookDispatcher: failed to save delivery log', {
            error: logErr.message,
            ruleId: rule.id,
          });
        }
      }
    }
  }

  /**
   * Resolve rules theo priority: Specific > CourseType > Global.
   * Nếu có rules ở priority cao nhất → chỉ dùng priority đó.
   * Cùng priority → trả tất cả.
   */
  _resolveRules(allRules, enrollment, course) {
    const specific = [];
    const courseType = [];
    const global = [];

    for (const rule of allRules) {
      const scopeType = rule.scope?.type;

      if (scopeType === ORDER_WEBHOOK_SCOPE_TYPES.SPECIFIC) {
        if (
          rule.scope.specificCourses &&
          rule.scope.specificCourses.some(sc => sc.courseId === enrollment.courseId)
        ) {
          specific.push(rule);
        }
      } else if (scopeType === ORDER_WEBHOOK_SCOPE_TYPES.COURSE_TYPE) {
        if (
          rule.scope.courseTypes &&
          rule.scope.courseTypes.includes(enrollment.courseType)
        ) {
          courseType.push(rule);
        }
      } else if (scopeType === ORDER_WEBHOOK_SCOPE_TYPES.GLOBAL) {
        global.push(rule);
      }
    }

    // Priority: specific > course_type > global
    if (specific.length) return specific;
    if (courseType.length) return courseType;
    return global;
  }

  _buildPayload(enrollment, course, customer, transactionGroupId) {
    return {
      event: ORDER_WEBHOOK_EVENTS.COMPLETED,
      order_id: transactionGroupId,
      status: 'complete',
      customer: {
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || '',
      },
      course: {
        id: course.id || enrollment.courseId,
        name: course.title || course.name || '',
        type: this._mapCourseType(enrollment.courseType),
        price: enrollment.amountPaid || 0,
      },
      payment_method: enrollment.paymentMethod || '',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Map internal course type to external-friendly string.
   * CourseOnline → 'online', CourseOffline → 'offline', CourseChallenge → 'challenge'
   */
  _mapCourseType(courseType) {
    const map = {
      [COURSE_TYPES.ONLINE]: 'online',
      [COURSE_TYPES.OFFLINE]: 'offline',
      [COURSE_TYPES.CHALLENGE]: 'challenge',
    };
    return map[courseType] || courseType;
  }

  async _sendWebhook(rule, payload) {
    const startTime = Date.now();
    try {
      const customHeaders = {};
      if (rule.headers && Array.isArray(rule.headers)) {
        rule.headers.forEach((h) => {
          if (h.key && h.value) {
            customHeaders[h.key] = h.value;
          }
        });
      }

      const response = await httpClient.instance({
        method: 'POST',
        url: rule.url,
        data: payload,
        headers: {
          'Content-Type': 'application/json',
          ...customHeaders,
        },
        timeout: 5000, // 5s timeout
        // Disable auto-retry cho webhook
        'axios-retry': { retries: 0 },
      });

      return {
        success: true,
        httpStatus: response?.status || 200,
        responseBody: this._truncateResponse(response?.data || response),
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
      return {
        success: false,
        httpStatus: err.response?.status || 0,
        responseBody: this._truncateResponse(err.response?.data || { error: err.message }),
        error: isTimeout ? 'Timeout (5s)' : err.message,
        isTimeout,
        durationMs: Date.now() - startTime,
      };
    }
  }

  _truncateResponse(data) {
    if (!data) return null;
    try {
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      return str.length > 500 ? str.substring(0, 500) + '...' : data;
    } catch {
      return String(data).substring(0, 500);
    }
  }

  _buildLogEntry(rule, payload, enrollment, course, settledResult) {
    const isResolved = settledResult.status === 'fulfilled';
    const result = isResolved ? settledResult.value : { success: false, error: settledResult.reason?.message };

    let status;
    if (result.success) {
      status = ORDER_WEBHOOK_DELIVERY_STATUSES.SUCCESS;
    } else if (result.isTimeout) {
      status = ORDER_WEBHOOK_DELIVERY_STATUSES.TIMEOUT;
    } else {
      status = ORDER_WEBHOOK_DELIVERY_STATUSES.FAILED;
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      event: ORDER_WEBHOOK_EVENTS.COMPLETED,
      targetUrl: rule.url,
      orderId: payload.order_id,
      courseId: enrollment.courseId,
      courseName: course.title || course.name || '',
      requestPayload: payload,
      httpStatus: result.httpStatus || null,
      responseBody: result.responseBody || null,
      status,
      error: result.error || null,
      durationMs: result.durationMs || null,
      sentAt: new Date(),
    };
  }
}

module.exports = new OrderWebhookDispatcher();
