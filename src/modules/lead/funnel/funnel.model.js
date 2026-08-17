const mongoose = require("mongoose");

const funnelSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    folderId: { type: String, ref: "FunnelFolder", default: null },
    groupId: { type: String, ref: "FunnelGroup", default: null },
    statusGroupId: { type: String, ref: "LeadStatusGroup", required: true },
    isActive: { type: Boolean, default: true },
    actionChainIds: [{ type: String, ref: "ActionChain" }],
    autoCreateChain: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false, id: false }
);

module.exports = mongoose.model("Funnel", funnelSchema);
