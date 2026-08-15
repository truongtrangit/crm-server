const mongoose = require("mongoose");
const {
  INTEGRATION_ACTION_TYPES,
  INTEGRATION_CONFIG_STATUSES,
} = require("../../../core/constants/integrationConfig");

const actionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(INTEGRATION_ACTION_TYPES),
      required: true,
    },
    enabled: { type: Boolean, default: true },
    /**
     * Config tuỳ theo type:
     *
     * create_event: {
     *   eventGroupId: "botvn_user_moi",            // ref EventGroup.id
     *   nameTemplate: "{{name}} đăng ký BotVN",    // template tên event
     * }
     *
     * create_lead: {
     *   funnelId: "FNL5",                           // ref Funnel.id
     *   defaultStage: "lead_moi",
     *   source: "BotVN",
     * }
     */
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const integrationConfigSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },

    // ── Trigger (free-form strings — không cần enum) ──
    source: { type: String, required: true, index: true },
    eventType: { type: String, required: true },

    // ── Display ──
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    // ── Actions ──
    actions: [actionSchema],

    // ── Field Mapping: CRM field → payload path ──
    fieldMapping: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        name: "name",
        email: "email",
        phone: "phone",
        avatar: "avatar",
      },
    },

    status: {
      type: String,
      enum: Object.values(INTEGRATION_CONFIG_STATUSES),
      default: INTEGRATION_CONFIG_STATUSES.ACTIVE,
    },

    triggerCount: { type: Number, default: 0 },
    lastTriggeredAt: { type: Date, default: null },

    /**
     * Biến template tự phát hiện từ payload webhook thực tế.
     * Được tự động cập nhật mỗi khi executeActions chạy.
     */
    discoveredVariables: { type: [String], default: [] },

    createdBy: { type: String, ref: "User", default: null },
  },
  { timestamps: true, versionKey: false, id: false },
);

// 1 source + 1 eventType = 1 config
integrationConfigSchema.index({ source: 1, eventType: 1 }, { unique: true });

module.exports = mongoose.model("IntegrationConfig", integrationConfigSchema);
