const mongoose = require("mongoose");
const {
  ALL_ACTION_TYPES,
  ACTION_CATEGORY_VALUES,
  ACTION_TYPE_CATEGORY_MAP,
} = require('../../../core/constants/actionConfig');

const actionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ALL_ACTION_TYPES,
      default: "call",
    },
    category: {
      type: String,
      enum: Object.values(ACTION_CATEGORY_VALUES),
      default: ACTION_CATEGORY_VALUES.PRIMARY,
    },
    reasonIds: [{ type: String, ref: "Reason", default: [] }],
    // When type = "send_block_automation", links to the BlockAutomation to execute
    blockAutomationId: { type: String, ref: "BlockAutomation", default: null },
    description: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

// Tự động suy ra category từ type nếu chưa có
actionSchema.pre("save", async function () {
  if (!this.category && this.type) {
    this.category = ACTION_TYPE_CATEGORY_MAP[this.type] || ACTION_CATEGORY_VALUES.PRIMARY;
  }
});

module.exports = mongoose.model("Action", actionSchema);
