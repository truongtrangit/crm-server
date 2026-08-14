const IntegrationConfig = require('./integrationConfig.model');
const EventService = require('../../event/event/event.service');
const Customer = require('../../customer/customer/customer.model');
const LeadService = require('../../lead/lead/lead.service');
const Lead = require('../../lead/lead/lead.model');
const LeadStatus = require('../../lead/leadConfig/leadStatus.model');
const TaskService = require('../../job/task/task.service');
const { LEAD_STAGE_MAP } = require('../../../core/constants/leadStages');
const TaskActionChainService = require('../../job/taskActionChain/taskActionChain.service');
const Task = require('../../job/task/task.model');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const { createHttpError } = require('../../../core/utils/http');
const {
  INTEGRATION_CONFIG_STATUSES,
  SYSTEM_INTEGRATION_EVENTS,
  INTEGRATION_ACTION_TYPES,
} = require('../../../core/constants/integrationConfig');
const logger = require('../../../core/utils/logger');
const IntegrationLogService = require('./integrationLog.service');

class IntegrationConfigService {
  // ── CRUD ──────────────────────────────────────────────────────────────

  async listConfigs(queryParams = {}) {
    const { source, status } = queryParams;
    const filter = {};
    if (source) filter.source = source;
    if (status) filter.status = status;

    return IntegrationConfig.find(filter).sort({ createdAt: -1 }).lean();
  }

  /**
   * Kích hoạt thủ công (manual trigger) từ UI admin.
   * ⚠️ LƯU Ý: Hàm này TẠO DATA THẬT (Event, Lead, Task) trong DB — không phải dry-run.
   */
  async testTrigger(source, eventType, payload = {}) {
    const result = await this.executeActions(source, eventType, payload);
    if (!result) {
      return {
        matched: false,
        message: `Không tìm thấy cấu hình tích hợp nào đang hoạt động cho source="${source}" và eventType="${eventType}".`,
      };
    }
    return {
      matched: true,
      message: 'Đã kích hoạt tích hợp thành công!',
      event: result.event || null,
      lead: result.lead || null,
      task: result.task || null,
    };
  }

  async getConfigById(id) {
    const config = await IntegrationConfig.findOne({ id }).lean();
    if (!config) {
      throw createHttpError(404, 'Integration Config not found.', {
        code: 'INTEGRATION_CONFIG_NOT_FOUND',
      });
    }
    return config;
  }

  async createConfig(data, currentUser) {
    // Check duplicate source + eventType
    const existing = await IntegrationConfig.findOne({
      source: data.source,
      eventType: data.eventType,
    });
    if (existing) {
      throw createHttpError(
        409,
        `Đã tồn tại config cho source="${data.source}" + eventType="${data.eventType}".`,
        { code: 'INTEGRATION_CONFIG_DUPLICATE' },
      );
    }

    const config = await IntegrationConfig.create({
      id: await generateMonotonicId(ID_PREFIXES.INTEGRATION_CONFIG),
      source: data.source,
      eventType: data.eventType,
      name: data.name,
      description: data.description || '',
      actions: data.actions || [],
      fieldMapping: data.fieldMapping || {},
      status: data.status || INTEGRATION_CONFIG_STATUSES.ACTIVE,
      createdBy: currentUser?.id || null,
    });

    return config;
  }

  async updateConfig(id, data) {
    const config = await IntegrationConfig.findOne({ id });
    if (!config) {
      throw createHttpError(404, 'Integration Config not found.', {
        code: 'INTEGRATION_CONFIG_NOT_FOUND',
      });
    }

    // Validate duplicate nếu đổi source/eventType
    if (data.source !== undefined || data.eventType !== undefined) {
      const newSource = data.source || config.source;
      const newEventType = data.eventType || config.eventType;
      if (newSource !== config.source || newEventType !== config.eventType) {
        const dup = await IntegrationConfig.findOne({
          source: newSource,
          eventType: newEventType,
          id: { $ne: id },
        });
        if (dup) {
          throw createHttpError(
            409,
            `Đã tồn tại config cho source="${newSource}" + eventType="${newEventType}".`,
            { code: 'INTEGRATION_CONFIG_DUPLICATE' },
          );
        }
      }
      config.source = newSource;
      config.eventType = newEventType;
    }

    if (data.name !== undefined) config.name = data.name;
    if (data.description !== undefined) config.description = data.description;
    if (data.actions !== undefined) config.actions = data.actions;
    if (data.fieldMapping !== undefined)
      config.fieldMapping = data.fieldMapping;
    if (data.status !== undefined) config.status = data.status;

    await config.save();
    return config;
  }

  async deleteConfig(id) {
    const config = await IntegrationConfig.findOneAndDelete({ id });
    if (!config) {
      throw createHttpError(404, 'Integration Config not found.', {
        code: 'INTEGRATION_CONFIG_NOT_FOUND',
      });
    }
    return config;
  }

  /**
   * Trả về danh sách unique sources — cho filter dropdown FE.
   */
  async getSources() {
    return IntegrationConfig.distinct('source');
  }

  /**
   * Trả về danh sách các event hệ thống được định nghĩa sẵn
   */
  getSystemEvents() {
    return SYSTEM_INTEGRATION_EVENTS;
  }

  // ── Core Execution ────────────────────────────────────────────────────

  /**
   * Thực thi actions theo config.
   *
   * 1. Lookup config theo source + eventType
   * 2. Không có config hoặc inactive → return null (no-op)
   * 3. Map payload fields theo fieldMapping
   * 4. Thực thi từng action trong actions[]
   *
   * @param {string} source    — "botvn", "zcode", ...
   * @param {string} eventType — "botvn_user_moi", ...
   * @param {object} payload   — raw data from the module
   * @returns {{ event, lead } | null}
   */
  async executeActions(source, eventType, payload) {
    const config = await IntegrationConfig.findOne({
      source,
      eventType,
      status: INTEGRATION_CONFIG_STATUSES.ACTIVE,
    });
    if (!config) {
      await IntegrationLogService.createLog({
        configId: null,
        source: source,
        eventType: eventType,
        status: 'NO_CONFIG',
        payload: payload,
        actionResults: [],
      });
      return null;
    }

    const mapped = this._mapPayload(payload, config.fieldMapping);
    await this._enrichMappedCustomer(mapped, payload);

    const result = { event: null, lead: null };

    const actionResults = [];
    let hasFailedAction = false;
    let hasSuccessAction = false;

    for (const action of config.actions) {
      if (!action.enabled) continue;

      try {
        let actionRes = null;
        switch (action.type) {
          case INTEGRATION_ACTION_TYPES.CREATE_EVENT:
            result.event = await this._createEvent(
              mapped,
              action.config,
              payload,
            );
            actionRes = {
              type: action.type,
              status: 'SUCCESS',
              eventId: result.event?.id,
            };
            break;
          case INTEGRATION_ACTION_TYPES.CREATE_LEAD: {
            const resLead = await this._createLead(
              mapped,
              action.config,
              payload,
            );
            result.lead = resLead.lead;
            if (resLead.task) result.task = resLead.task;
            actionRes = {
              type: action.type,
              status: 'SUCCESS',
              leadId: result.lead?.id,
              taskId: result.task?.id,
            };
            break;
          }
          default:
            logger.warn('IntegrationConfig: unknown action type', {
              type: action.type,
            });
            actionRes = {
              type: action.type,
              status: 'FAILED',
              error: 'Unknown action type',
            };
        }
        if (actionRes) {
          actionResults.push(actionRes);
          if (actionRes.status === 'SUCCESS') hasSuccessAction = true;
          else hasFailedAction = true;
        }
      } catch (err) {
        logger.error(`IntegrationConfig: action ${action.type} failed`, {
          error: err.message,
          configId: config._id,
        });
        actionResults.push({
          type: action.type,
          status: 'FAILED',
          error: err.message,
        });
        hasFailedAction = true;
      }
    }

    let overallStatus = 'SUCCESS';
    if (hasFailedAction && hasSuccessAction) overallStatus = 'PARTIAL';
    else if (hasFailedAction && !hasSuccessAction) overallStatus = 'FAILED';

    await IntegrationLogService.createLog({
      configId: config.id,
      source: source,
      eventType: eventType,
      status: overallStatus,
      payload: payload,
      actionResults: actionResults,
    });

    // Update trigger metrics + auto-discover payload variables
    const newVars = this._extractPayloadKeys(payload);
    const mergedVars = [
      ...new Set([...(config.discoveredVariables || []), ...newVars]),
    ];

    IntegrationConfig.updateOne(
      { _id: config._id },
      {
        $inc: { triggerCount: 1 },
        $set: {
          lastTriggeredAt: new Date(),
          discoveredVariables: mergedVars,
        },
      },
    ).catch((err) =>
      logger.warn('IntegrationConfig: metrics update error', {
        error: err.message,
      }),
    );

    return result;
  }

  /**
   * Trả về danh sách biến template khả dụng cho 1 config.
   * Merge: predefined (từ SYSTEM_INTEGRATION_EVENTS) + discovered (từ payload thực tế).
   */
  getVariablesForConfig(config) {
    const predefined = this._getPredefinedVariables(
      config.source,
      config.eventType,
    );
    const discovered = config.discoveredVariables || [];
    // Merge & deduplicate, giữ thứ tự predefined trước
    const merged = [...predefined];
    for (const v of discovered) {
      if (!merged.includes(v)) merged.push(v);
    }
    return merged;
  }

  /**
   * Lấy biến predefined từ SYSTEM_INTEGRATION_EVENTS constant.
   */
  _getPredefinedVariables(source, eventType) {
    const events = SYSTEM_INTEGRATION_EVENTS[source];
    if (!events) return [];
    const evt = events.find((e) => e.value === eventType);
    return evt?.variables || [];
  }

  /**
   * Trích xuất tất cả keys từ payload (hỗ trợ nested 2 cấp).
   * Bỏ qua các key internal (_source, _id, __v, password, token...).
   */
  _extractPayloadKeys(payload, prefix = '', depth = 0) {
    if (!payload || typeof payload !== 'object' || depth > 2) return [];
    const SKIP_KEYS = new Set([
      '_id',
      '__v',
      '_source',
      'password',
      'token',
      'secret',
      'accessToken',
      'refreshToken',
    ]);
    const keys = [];
    for (const [key, value] of Object.entries(payload)) {
      if (SKIP_KEYS.has(key) || key.startsWith('_')) continue;
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.push(fullKey);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        keys.push(...this._extractPayloadKeys(value, fullKey, depth + 1));
      }
    }
    return keys;
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  /**
   * Tự động tìm Customer trong DB theo customerId / email / phone nếu payload thiếu thông tin.
   */
  async _enrichMappedCustomer(mapped, payload) {
    const custId = payload?.customerId || payload?.customer_id;

    let customer = null;
    if (custId) {
      customer = await Customer.findOne({ id: custId }).lean();
    }
    if (!customer && mapped.email) {
      customer = await Customer.findOne({
        email: mapped.email.toLowerCase(),
      }).lean();
    }
    if (!customer && mapped.phone) {
      customer = await Customer.findOne({ phone: mapped.phone }).lean();
    }

    if (customer) {
      mapped.name = mapped.name || customer.name;
      mapped.email = mapped.email || customer.email;
      mapped.phone = mapped.phone || customer.phone;
      mapped.avatar = mapped.avatar || customer.avatar;
      mapped.customerId = customer.id;
    }
  }

  /**
   * Truyền toàn bộ payload sang (pass-through).
   * Tự động resolve các field động từ fieldMapping và fallback cho các trường cơ bản.
   */
  _mapPayload(payload = {}, fieldMapping = {}) {
    const mapped = { ...payload };

    // 1. Ánh xạ các trường động từ fieldMapping
    if (fieldMapping && typeof fieldMapping === 'object') {
      for (const [crmField, payloadPath] of Object.entries(fieldMapping)) {
        if (payloadPath && typeof payloadPath === 'string') {
          const val = this._resolveField(payload, payloadPath);
          if (val !== undefined) {
            mapped[crmField] = val;
          }
        }
      }
    }

    // 2. Fallback cho các trường bắt buộc nếu chưa được map hoặc bị thiếu
    mapped.name =
      mapped.name ||
      payload.name ||
      payload.fullName ||
      payload.full_name ||
      payload.customerName ||
      payload.customer_name ||
      '';
    mapped.email =
      mapped.email ||
      payload.email ||
      payload.userEmail ||
      payload.customerEmail ||
      payload.customer_email ||
      '';
    mapped.phone =
      mapped.phone ||
      payload.phone ||
      payload.userPhone ||
      payload.phoneNumber ||
      payload.phone_number ||
      payload.customerPhone ||
      '';
    mapped.avatar =
      mapped.avatar ||
      payload.avatar ||
      payload.userAvatar ||
      payload.customerAvatar ||
      '';

    return mapped;
  }

  /** Resolve nested field: "order.customerName" → payload.order.customerName */
  _resolveField(obj, path) {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  /** Resolve template: "{{name}} - {{amount}}đ" → mapped/raw values */
  _resolveTemplate(template, mapped, rawPayload) {
    if (!template) return '';
    return template.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
      const mappedVal = this._resolveField(mapped, key);
      const rawVal = this._resolveField(rawPayload, key);
      return mappedVal !== undefined
        ? mappedVal
        : rawVal !== undefined
          ? rawVal
          : '';
    });
  }

  /**
   * Tạo Event — delegate cho EventService.createEvent().
   * nameTemplate hỗ trợ {{name}}, {{email}} substitution.
   */
  async _createEvent(mapped, actionConfig, rawPayload) {
    const custName =
      mapped.name || mapped.email || mapped.phone || 'Khách hàng mới';
    const eventName = this._resolveTemplate(
      actionConfig?.nameTemplate || custName || 'Sự kiện mới',
      mapped,
      rawPayload,
    );

    return EventService.createEvent(
      {
        name: eventName,
        group: actionConfig?.eventGroupId || 'Unknown',
        customer: {
          name: custName,
          email: mapped.email || '',
          phone: mapped.phone || '',
          avatar: mapped.avatar || '',
          source: rawPayload?._source || '',
        },
        source: 'Integration',
        tags: ['#Auto'],
      },
      null, // currentUser = null (system-created)
    );
  }

  /**
   * Tạo / Cập nhật Lead thông minh — tuân thủ 100% cấu hình tích hợp (Sol 5.6).
   * - Hỗ trợ nameTemplate (vd: {{name}} - Nạp {{amount}}đ)
   * - Tuân thủ chính xác defaultStage & funnelId cấu hình
   * - Smart Upsert: Nếu khách đã có Lead trong Phễu này -> Cập nhật Stage & Log chứ không tạo trùng
   */
  async _createLead(mapped, actionConfig, rawPayload) {
    // customerId đã được resolve bởi _enrichMappedCustomer ở trên
    const customerId = mapped.customerId || null;

    // Format Lead Name using nameTemplate if provided, or mapped name/email/phone
    const leadName = this._resolveTemplate(
      actionConfig?.nameTemplate ||
        mapped.name ||
        mapped.email ||
        mapped.phone ||
        'Lead mới',
      mapped,
      rawPayload,
    );

    const targetFunnelId = actionConfig?.funnelId || null;
    const targetStage = actionConfig?.defaultStage || null;
    const leadSource = actionConfig?.source || mapped.source || 'Integration';

    // Smart Upsert: Check if an active Lead already exists in this Funnel for this Customer
    let existingLead = null;
    if (targetFunnelId && (customerId || mapped.email || mapped.phone)) {
      const orConds = [];
      if (customerId) orConds.push({ customerId });
      if (mapped.email) orConds.push({ email: mapped.email.toLowerCase() });
      if (mapped.phone) orConds.push({ phone: mapped.phone });

      if (orConds.length > 0) {
        existingLead = await Lead.findOne({
          funnelId: targetFunnelId,
          isArchived: false,
          $or: orConds,
        });
      }
    }

    let finalLead = null;

    // If Lead already exists in this Funnel -> Update it (Smart Upsert)
    if (existingLead) {
      if (targetFunnelId) {
        existingLead.statusId = targetStage;
      } else {
        existingLead.stage = targetStage;
      }
      if (leadSource) existingLead.source = leadSource;
      if (mapped.avatar) existingLead.avatar = mapped.avatar;
      if (
        mapped.name &&
        (!existingLead.name || existingLead.name === 'Lead mới')
      ) {
        existingLead.name = mapped.name;
      }

      let humanReadableStage = targetStage;
      if (targetStage) {
        if (targetFunnelId) {
          const statusDoc = await LeadStatus.findOne({ id: targetStage }).lean();
          if (statusDoc) humanReadableStage = statusDoc.name;
        } else {
          const stageConfig = LEAD_STAGE_MAP[targetStage];
          if (stageConfig) humanReadableStage = stageConfig.label;
        }
      }

      existingLead.activityLogs.push({
        action: 'stage_change',
        description: `Tích hợp tự động cập nhật Lead sang giai đoạn "${humanReadableStage}"`,
        performedBy: {
          userId: null,
          userName: 'System Integration',
          userAvatar: '',
        },
      });
      await existingLead.save();
      finalLead = existingLead;
    } else {
      // Create New Lead following exact actionConfig
      finalLead = await LeadService.createLead(
        {
          name: leadName,
          email: mapped.email || '',
          phone: mapped.phone || '',
          avatar: mapped.avatar || '',
          funnelId: targetFunnelId,
          stage: targetFunnelId ? undefined : targetStage,
          statusId:
            actionConfig?.statusId || (targetFunnelId ? targetStage : null),
          source: leadSource,
          tags: ['#Auto'],
          note:
            actionConfig?.note ||
            `Tự động tạo từ tích hợp (${rawPayload?._source || 'Integration'})`,
        },
        null, // system created
      );
    }

    // NOTE: Kiểm tra biến tạm `_autoTask` được gán bởi LeadService trong lúc tạo Lead (nếu Phễu có bật autoCreateChain).
    // Nếu Phễu đã tạo Task rồi thì dùng luôn Task đó để gộp chuỗi hành động, tránh sinh ra 2 Task trùng lặp.
    let createdTask = finalLead?._autoTask || null;

    if (actionConfig?.createTask) {
      try {
        if (!createdTask && finalLead) {
          // Nếu không có _autoTask (vd Lead được tạo từ trước, tìm trong CSDL xem Lead có Task đang mở không)
          createdTask = await Task.findOne({
            'linkedLeads.leadId': finalLead.id,
            status: 'active',
            isArchived: { $ne: true },
          }).sort({ createdAt: -1 });
        }

        if (createdTask) {
          logger.info(
            `[Integration] Tìm thấy Tác vụ đang mở của Lead ${finalLead.id}. Tiến hành gộp chuỗi hành động tránh trùng lặp.`,
          );

          if (
            actionConfig.taskActionChainIds &&
            Array.isArray(actionConfig.taskActionChainIds)
          ) {
            for (const chainId of actionConfig.taskActionChainIds) {
              try {
                await TaskActionChainService.addChainToTask(
                  createdTask.id,
                  chainId,
                  null,
                );
              } catch (addChainErr) {
                if (addChainErr?.status === 409) {
                  // Ignore 409: Chuỗi hành động đã có trong task
                  logger.info(
                    `[Integration] Chuỗi ${chainId} đã tồn tại trong task ${createdTask.id}`,
                  );
                } else {
                  throw addChainErr;
                }
              }
            }
          }

          finalLead.activityLogs.push({
            action: 'update',
            description: `Tích hợp tự động gộp các chuỗi hành động vào Tác vụ "${createdTask.name}" đang mở để tránh tạo trùng lặp tác vụ.`,
            performedBy: {
              userId: null,
              userName: 'System Integration',
              userAvatar: '',
            },
          });
          await finalLead.save();
        } else {
          const taskName = this._resolveTemplate(
            actionConfig.taskNameTemplate || 'Xử lý Lead {{name}}',
            mapped,
            rawPayload,
          );

          createdTask = await TaskService.createTask(
            {
              name: taskName,
              note: `Tự động tạo từ tích hợp (${rawPayload?._source || 'Integration'})`,
              linkedLeads: [{ leadId: finalLead.id }],
            },
            null, // system created
          );

          if (
            actionConfig.taskActionChainIds &&
            Array.isArray(actionConfig.taskActionChainIds)
          ) {
            for (const chainId of actionConfig.taskActionChainIds) {
              await TaskActionChainService.addChainToTask(
                createdTask.id,
                chainId,
                null,
              );
            }
          }
        }
      } catch (err) {
        logger.error(
          `Lỗi tạo auto-task cho integration lead ${finalLead.id}:`,
          err,
        );
      }
    }

    return { lead: finalLead, task: createdTask };
  }
}

module.exports = new IntegrationConfigService();
