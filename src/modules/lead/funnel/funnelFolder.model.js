const mongoose = require("mongoose");

const funnelFolderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    statusGroupId: { type: String, ref: "LeadStatusGroup", required: true },
  },
  { timestamps: true, versionKey: false, id: false }
);

module.exports = mongoose.model("FunnelFolder", funnelFolderSchema);
