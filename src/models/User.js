const mongoose = require("mongoose");
const { softDeletePlugin } = require("../utils/softDelete");

const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true },
    accessTokenHash: { type: String, required: true },
    refreshTokenHash: { type: String, required: true },
    accessTokenExpiresAt: { type: Date, required: true },
    refreshTokenExpiresAt: { type: Date, required: true },
    userAgent: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
  },
  {
    _id: false,
    id: false,
  },
);

const passwordResetSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    requestedAt: { type: Date, default: null },
  },
  {
    _id: false,
    id: false,
  },
);

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true },
    avatar: { type: String, default: "" },
    department: { type: [String], default: [] },
    departmentAliases: { type: [String], default: [] },
    group: { type: [String], default: [] },
    groupAliases: { type: [String], default: [] },
    phone: { type: String, default: "" },
    roleId: { type: String, default: null }, // Reference to Role model for RBAC
    permissions: { type: [String], default: [] }, // Additional custom permissions
    managerId: { type: String, default: null },
    createdBy: { type: String, default: null },
    lastLoginAt: { type: Date, default: null },
    passwordReset: { type: passwordResetSchema, default: () => ({}) },
    sessions: { type: [sessionSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

userSchema.plugin(softDeletePlugin);

module.exports = mongoose.model("User", userSchema);
