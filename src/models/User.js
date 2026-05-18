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
    departmentRoles: { type: mongoose.Schema.Types.Mixed, default: {} },
    departmentAliases: { type: [String], default: [] },
    group: { type: [String], default: [] },
    groupRoles: { type: mongoose.Schema.Types.Mixed, default: {} },
    groupAliases: { type: [String], default: [] },
    phone: { type: String, default: "" },
    companies: { type: [String], default: [] },
    roleId: { type: String, default: null, index: true }, // Reference to Role model for RBAC
    permissions: { type: [String], default: [] }, // Additional custom permissions
    functions: { type: [String], default: [] }, // Reference to StaffFunction ids
    createdBy: { type: String, default: null },
    lastLoginAt: { type: Date, default: null },
    passwordReset: { type: passwordResetSchema, default: () => ({}) },
    sessions: { type: [sessionSchema], default: [] },
    isActive: { type: Boolean, default: true },
    preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

userSchema.plugin(softDeletePlugin);

// Performance indexes for list queries
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
