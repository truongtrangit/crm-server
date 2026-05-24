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

userSchema.virtual("departmentAliases").get(function () {
  return Array.isArray(this.departments)
    ? [...new Set(this.departments.map(d => d.deptAlias).filter(Boolean))]
    : [];
});

userSchema.virtual("groupAliases").get(function () {
  return Array.isArray(this.groups)
    ? [...new Set(this.groups.map(g => g.groupAlias).filter(Boolean))]
    : [];
});

userSchema.virtual("departmentRoles").get(function () {
  const roles = {};
  if (Array.isArray(this.departments)) {
    this.departments.forEach(d => {
      roles[d.deptAlias] = d.role || "member";
    });
  }
  return roles;
});

userSchema.virtual("groupRoles").get(function () {
  const roles = {};
  if (Array.isArray(this.groups)) {
    this.groups.forEach(g => {
      const deptAlias = g.groupAlias.split("__")[0];
      roles[`${deptAlias}:${g.groupAlias}`] = g.role || "member";
    });
  }
  return roles;
});
userSchema.plugin(softDeletePlugin);

// Performance indexes for list queries
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
