const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    resource: { type: String, required: true }, // customers, users, leads, tasks, etc.
    action: { type: String, required: true }, // create, read, update, delete, manage
    createdBy: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("Permission", permissionSchema);
