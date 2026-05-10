const mongoose = require("mongoose");

const funnelGroupSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    folderId: { type: String, ref: "FunnelFolder", required: true },
    statusGroupId: { type: String, ref: "LeadStatusGroup", required: true },
  },
  { timestamps: true, versionKey: false, id: false }
);

module.exports = mongoose.model("FunnelGroup", funnelGroupSchema);
