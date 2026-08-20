const PLATFORMS = ["SmaxAi", "Botvn", "App.vn"];
const COMPANIES = ["SmaxAi", "App.vn", "Cdp.vn"]; // Danh sách công ty cho nhân viên
const CUSTOMER_GROUPS = ["Mới", "Tiềm năng", "Thân thiết", "Rời bỏ", "VIP"];
const CUSTOMER_TYPES_MAPPING = {
  NEW_CUSTOMER: "New Customer",
  STANDARD_CUSTOMER: "Standard Customer",
  VIP_CUSTOMER: "VIP Customer",
  PARTNER: "Partner",
  REGULAR: "Regular",
  PREMIUM: "Premium",
};
const CUSTOMER_TYPES = Object.values(CUSTOMER_TYPES_MAPPING);

// ─── Customer taxonomy: mainType ────────────────────────────────────────────

/** Top-level category separating Business accounts from individual Users */
const CUSTOMER_MAIN_TYPES = Object.freeze({
  BIZ: "biz",
  USER: "user",
});

/**
 * Sub-types for mainType = 'biz'.
 * Automatically inferred from the biz order on webhook; editable by OWNER/ADMIN.
 */
const BIZ_SUB_TYPES = Object.freeze({
  NEW_BIZ: "new_biz",       // Biz mới tạo / TRIAL
  PAID_BIZ: "paid_biz",     // Đang trong gói trả phí còn hạn
  EXPIRED_BIZ: "expired_biz", // Hết hạn
});

/**
 * Sub-types for mainType = 'user'.
 * Set manually by OWNER/ADMIN/MANAGER after creation; defaults to empty.
 */
const USER_SUB_TYPES = Object.freeze({
  OWNER: "owner",       // Chủ doanh nghiệp / tài khoản
  AGENCY: "agency",     // Đại lý
  SELLER: "seller",     // Nhân viên kinh doanh
});

/** Ordered lists — used for validation and UI dropdowns */
const BIZ_SUB_TYPE_LIST = Object.values(BIZ_SUB_TYPES);
const USER_SUB_TYPE_LIST = Object.values(USER_SUB_TYPES);

/**
 * Infer biz sub-type from the order snapshot inside a biz webhook payload.
 * FREE + within date window → new_biz
 * Paid plan (ENTERPRISE etc.) + within date window → paid_biz
 * past time_end → expired_biz
 * Fallback → new_biz
 *
 * @param {{ type?: string, time_start?: string, time_end?: string }} order
 * @returns {string} one of BIZ_SUB_TYPES
 */
function classifyBizSubType(order = {}) {
  const now = new Date();
  const endDate = order.time_end ? new Date(order.time_end) : null;
  const planType = (order.type || "FREE").toUpperCase();

  if (endDate && endDate < now) return BIZ_SUB_TYPES.EXPIRED_BIZ;
  if (planType === "FREE" || planType === "TRIAL") return BIZ_SUB_TYPES.NEW_BIZ;
  return BIZ_SUB_TYPES.PAID_BIZ;
}

const USER_ROLE_VALUES = Object.freeze({
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  STAFF: "STAFF",
});

const USER_ROLES = [
  { value: USER_ROLE_VALUES.OWNER, label: "Owner" },
  { value: USER_ROLE_VALUES.ADMIN, label: "Admin" },
  { value: USER_ROLE_VALUES.MANAGER, label: "Manager (Trưởng phòng)" },
  { value: USER_ROLE_VALUES.STAFF, label: "Staff (Nhân viên)" },
];

const DEFAULT_USER_ROLE = USER_ROLE_VALUES.STAFF;

const DEFAULT_PASSWORD_STRENGTH = 8;

const VOUCHER_TYPES = {
  SINGLE: 'single',
  SHARED: 'shared'
};

const VOUCHER_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  USED: 'used',
  EXPIRED: 'expired'
};

const COURSE_ENROLLMENT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  LOCKED: 'LOCKED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
});

const KNOWLEDGE_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

const COURSE_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  PRIVATE: 'private',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
});

const COURSE_TYPES = Object.freeze({
  CHALLENGE: 'CourseChallenge',
  ONLINE: 'CourseOnline',
  OFFLINE: 'CourseOffline',
});

const PAYMENT_METHODS = Object.freeze({
  MAIN_CREDIT: 'mainCredit',
  REWARD_CREDIT: 'rewardCredit',
  EDU_CREDIT: 'eduCredit',
  FREE: 'free',
});

const LESSON_ACCESS_LEVEL = Object.freeze({
  FREE: "Free",
  PAID: "Paid",
});

const BOTVN_ROLES = Object.freeze({
  ADMIN: "ADMIN",
  INSTRUCTOR: "INSTRUCTOR",
  TA: "TA",
  STUDENT: "STUDENT",
});

const CREDIT_TRANSACTION_TYPES = Object.freeze({
  IN: "IN",
  OUT: "OUT",
});

const CREDIT_TYPES = Object.freeze({
  MAIN: "main",
  REWARD: "reward",
  EDU: "edu",
});

const CREDIT_SOURCES = Object.freeze({
  SMAXAI: "smaxai",
  VOUCHER: "voucher",
  BANK_TRANSFER: "bank_transfer",
  COURSE_PURCHASE: "course_purchase",
  OTHER: "other",
});

const CREDIT_TRANSACTION_STATUS = Object.freeze({
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
});

const SUBMISSION_LEVEL = Object.freeze({
  NONE: 'none',
  LESSON: 'lesson',
  CHAPTER: 'chapter',
  COURSE: 'course',
});

const SUBMISSION_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

const QR_SESSION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  SCANNED: 'SCANNED',
  AUTHENTICATED: 'AUTHENTICATED',
  REGISTRATION_DISABLED: 'REGISTRATION_DISABLED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
});

const AUTH_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  LOGIN_METHOD_DISABLED: 'LOGIN_METHOD_DISABLED',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',
  REGISTRATION_DISABLED: 'REGISTRATION_DISABLED',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  QR_EXPIRED: 'QR_EXPIRED',
  QR_ALREADY_USED: 'QR_ALREADY_USED',
  QR_CONTEXT_NOT_CONFIRMED: 'QR_CONTEXT_NOT_CONFIRMED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
});

const TOPUP_REQUEST_STATUS = Object.freeze({
  PENDING: 'pending',
  USER_CONFIRMED: 'user_confirmed',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELED: 'canceled',
});

const BUSINESS_TYPES = Object.freeze({
  COMPANY: 'company',
  HOUSEHOLD: 'household',
  INDIVIDUAL: 'individual',
});

// ─── Order Webhook ───────────────────────────────────────────────────────────
const ORDER_WEBHOOK_EVENTS = Object.freeze({
  COMPLETED: 'order.completed',
  // Phase 2: NEW: 'order.new', UPDATED: 'order.updated', CANCELLED: 'order.cancelled',
});

const ORDER_WEBHOOK_SCOPE_TYPES = Object.freeze({
  GLOBAL: 'global',
  COURSE_TYPE: 'course_type',
  SPECIFIC: 'specific',
});

const ORDER_WEBHOOK_DELIVERY_STATUSES = Object.freeze({
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
});

module.exports = {
  PLATFORMS,
  COMPANIES,
  CUSTOMER_GROUPS,
  CUSTOMER_TYPES,
  CUSTOMER_TYPES_MAPPING,
  CUSTOMER_MAIN_TYPES,
  BIZ_SUB_TYPES,
  USER_SUB_TYPES,
  BIZ_SUB_TYPE_LIST,
  USER_SUB_TYPE_LIST,
  classifyBizSubType,
  DEFAULT_USER_ROLE,
  USER_ROLES,
  USER_ROLE_VALUES,
  DEFAULT_PASSWORD_STRENGTH,
  VOUCHER_TYPES,
  VOUCHER_STATUSES,
  COURSE_ENROLLMENT_STATUS,
  COURSE_STATUS,
  KNOWLEDGE_STATUS,
  COURSE_TYPES,
  PAYMENT_METHODS,
  BOTVN_ROLES,
  CREDIT_TRANSACTION_TYPES,
  CREDIT_TYPES,
  CREDIT_SOURCES,
  CREDIT_TRANSACTION_STATUS,
  LESSON_ACCESS_LEVEL,
  SUBMISSION_LEVEL,
  SUBMISSION_STATUS,
  QR_SESSION_STATUS,
  AUTH_ERROR_CODES,
  TOPUP_REQUEST_STATUS,
  BUSINESS_TYPES,
  ORDER_WEBHOOK_EVENTS,
  ORDER_WEBHOOK_SCOPE_TYPES,
  ORDER_WEBHOOK_DELIVERY_STATUSES,
};
