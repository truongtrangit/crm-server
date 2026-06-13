const mongoose = require("mongoose");

const reasonSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("Reason", reasonSchema);
