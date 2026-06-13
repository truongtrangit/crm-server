const mongoose = require("mongoose");

/**
 * Subscription — Gói cước / đăng ký dịch vụ.
 *
 * Thiết kế generic: dùng cho cả gói cước từ webhook (SmaxAi order)
 * lẫn các gói nội bộ CRM trong tương lai.
 *
 * Reference:
 *   - Event.subscriptionId → Subscription.id
 *   - Customer.id → Subscription.customerId (ai sở hữu gói)
 */
const subscriptionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },

    // ─── Nguồn gốc ──────────────────────────────────────────────────────
    /** ID bên thứ 3 (e.g. SmaxAi order id) — dùng để dedup */
    externalId: { type: String, default: null, index: true, sparse: true },
    /** Nguồn: "SmaxAi", "Stripe", "CRM", ... */
    source: { type: String, default: "CRM" },

    // ─── Thông tin gói ───────────────────────────────────────────────────
    /** Mã đơn hàng / coupon (e.g. "SAI-SLP05YHEN0") */
    code: { type: String, default: "" },
    /** Loại gói: FREE, ENTERPRISE, PRO, ... */
    planType: { type: String, default: "FREE" },
    /** Tên hiển thị (e.g. "ENTERPRISE — SAI-SLP05YHEN0") */
    name: { type: String, default: "" },

    // ─── Thời hạn ────────────────────────────────────────────────────────
    /** Số tháng (e.g. 3) */
    months: { type: Number, default: 0 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    // ─── Hạn mức (quotas) ────────────────────────────────────────────────
    maxMembers: { type: Number, default: 0 },
    maxPages: { type: Number, default: 0 },
    maxCustomers: { type: Number, default: 0 },
    maxCards: { type: Number, default: 0 },
    usedCards: { type: Number, default: 0 },
    totalCustomers: { type: Number, default: 0 },

    // ─── Tính năng ───────────────────────────────────────────────────────
    botAvailable: { type: Boolean, default: false },
    chatAvailable: { type: Boolean, default: false },

    // ─── Thanh toán ──────────────────────────────────────────────────────
    /** Tổng số tiền */
    totalAmount: { type: Number, default: 0 },
    /** Đơn vị tiền tệ (USD, VND, ...) */
    currency: { type: String, default: "VND" },
    /** Cổng thanh toán (manual, stripe, ...) */
    paymentGate: { type: String, default: "" },
    /** Loại đơn hàng (subcription, addon, ...) */
    orderType: { type: String, default: "" },
    /** Đơn hàng đầu tiên? */
    isFirstOrder: { type: Boolean, default: false },

    // ─── Liên kết ────────────────────────────────────────────────────────
    /** Link tới Customer sở hữu gói */
    customerId: { type: String, ref: "Customer", default: null, index: true },
    /** ID biz bên thứ 3 — dùng để link khi biz create đến */
    externalBizId: { type: String, default: null, index: true, sparse: true },
    /** ID tác giả / người đặt bên thứ 3 */
    externalAuthorId: { type: String, default: null },
    /** ID đơn hàng cha (gia hạn / nâng cấp) */
    parentOrderId: { type: String, default: null },

    // ─── Trạng thái ──────────────────────────────────────────────────────
    /** active | expired | cancelled | pending | inactive | none | paid */
    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "pending", "inactive", "none", "paid"],
      default: "inactive",
    },

    // ─── Dữ liệu mở rộng ────────────────────────────────────────────────
    /** Lưu toàn bộ payload gốc hoặc metadata bổ sung */
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
