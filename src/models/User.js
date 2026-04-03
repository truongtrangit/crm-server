const mongoose = require("mongoose");
const { DEFAULT_USER_ROLE, USER_ROLE_VALUES } = require("../constants/appData");

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
    group: { type: [String], default: [] },
    phone: { type: String, default: "" },
    role: {
      type: String,
      required: true,
      trim: true,
      enum: Object.values(USER_ROLE_VALUES),
      default: DEFAULT_USER_ROLE,
    },
    managerId: { type: String, default: null },
    createdBy: { type: String, default: null },
    lastLoginAt: { type: Date, default: null },
    sessions: { type: [sessionSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("User", userSchema);
