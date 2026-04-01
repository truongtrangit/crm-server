const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    avatar: { type: String, default: "" },
    department: { type: [String], default: [] },
    group: { type: [String], default: [] },
    phone: { type: String, default: "" },
    role: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("Staff", staffSchema);
