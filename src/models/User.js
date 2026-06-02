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

const moduleAccessEntrySchema = new mongoose.Schema(
  {
    moduleId: { type: String, required: true },
    isEnabled: { type: Boolean, default: true },
    customPermissions: { type: [String], default: null }, // null = fallback to RBAC role
  },
  {
    _id: false,
    id: false,
  },
);

const userDepartmentSchema = new mongoose.Schema(
  {
    deptAlias: { type: String, required: true },
    role: { type: String, enum: ["lead", "member"], default: "member" },
  },
  {
    _id: false,
    id: false,
  }
);

const userGroupSchema = new mongoose.Schema(
  {
    groupAlias: { type: String, required: true },
    role: { type: String, enum: ["lead", "member"], default: "member" },
  },
  {
    _id: false,
    id: false,
  }
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
    phone: { type: String, default: "" },
    companies: { type: [String], default: [] },
    roleId: { type: String, default: null, index: true }, // Reference to Role model for RBAC
    permissions: { type: [String], default: [] }, // Additional custom permissions
    functions: { type: [String], default: [] },
    functionalGroups: { type: [String], default: [] },
    departments: { type: [userDepartmentSchema], default: [] },
    groups: { type: [userGroupSchema], default: [] },
    createdBy: { type: String, default: null },
    lastLoginAt: { type: Date, default: null },
    passwordReset: { type: passwordResetSchema, default: () => ({}) },
    sessions: { type: [sessionSchema], default: [] },
    isActive: { type: Boolean, default: true },
    preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
    moduleAccess: { type: [moduleAccessEntrySchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);


userSchema.plugin(softDeletePlugin);

// Performance indexes for list queries
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
