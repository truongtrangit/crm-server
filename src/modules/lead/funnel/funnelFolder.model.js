const mongoose = require("mongoose");

const funnelFolderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    defaultStatusGroupId: { type: String, ref: "LeadStatusGroup", default: null },
  },
  { timestamps: true, versionKey: false, id: false }
);

module.exports = mongoose.model("FunnelFolder", funnelFolderSchema);
