const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    permissions: [
      {
        type: String,
        required: true,
      },
    ], // IDs of permissions
    level: { type: Number, default: 0 }, // For hierarchy: STAFF=1, MANAGER=2, ADMIN=3, OWNER=4
    isSystem: { type: Boolean, default: false }, // System roles cannot be deleted
    createdBy: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("Role", roleSchema);
