const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    logo: { type: String, default: "" }, // URL or text
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  }
);

module.exports = mongoose.model("Company", companySchema);
