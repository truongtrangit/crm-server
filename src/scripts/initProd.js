/**
 * initProd.js — Khởi tạo dữ liệu tối thiểu cho môi trường UAT / PROD
 *
 * Script này chỉ tạo (upsert) các dữ liệu cốt lõi bắt buộc:
 *   ✅ RBAC Permissions + Roles (upsert — an toàn khi chạy lại)
 *   ✅ StaffFunctions cơ bản    (upsert — an toàn khi chạy lại)
 *   ✅ User OWNER & ADMIN       (chỉ tạo nếu chưa tồn tại — KHÔNG ghi đè)
 *   ✅ Counter khởi tạo         (chỉ tạo nếu chưa có)
 *
 * ✅ AN TOÀN: Script KHÔNG xoá bất kỳ dữ liệu hiện có nào.
 * ✅ IDEMPOTENT: Có thể chạy lại nhiều lần mà không gây lỗi.
 *
 * Cách chạy:
 *   node src/scripts/initProd.js
 *
 * Biến môi trường bắt buộc (trong .env):
 *   MONGO_URI
 *   OWNER_EMAIL      (mặc định: owner@company.vn)
 *   OWNER_PASSWORD   (bắt buộc đặt trong .env — KHÔNG có default)
 *   ADMIN_EMAIL      (mặc định: admin@company.vn)
 *   ADMIN_PASSWORD   (bắt buộc đặt trong .env — KHÔNG có default)
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");

// ─── Models ───
const User          = require("../models/User");
const StaffFunction = require("../models/StaffFunction");
const Counter       = require("../models/Counter");

// ─── Helpers ───
const { hashPassword } = require("../utils/auth");
const { seedRbac }     = require("../services/rbacSeed");

// ─── Minimal StaffFunctions ───────────────────────────────────────────────────
const STAFF_FUNCTIONS = [
  { id: "FUNC1", title: "Marketing",       type: "marketing", desc: "Quản lý chiến dịch quảng cáo, tạo leads đầu vào." },
  { id: "FUNC2", title: "Sale (Bán hàng)", type: "sale",      desc: "Tiếp nhận Lead từ Marketing, chăm sóc và chốt đơn." },
  { id: "FUNC3", title: "Kỹ Thuật",        type: "tech",      desc: "Xây dựng và bảo trì nền tảng CRM." },
  { id: "FUNC4", title: "CSKH",            type: "cskh",      desc: "Chăm sóc và hỗ trợ sau bán hàng." },
];

// ─── Minimal Counters ─────────────────────────────────────────────────────────
const INITIAL_COUNTERS = [
  { _id: "USER", seq: 2 },   // owner=1, admin=2 → next sẽ là 3
  { _id: "CUST", seq: 0 },
  { _id: "EVT",  seq: 0 },
  { _id: "RES",  seq: 0 },
  { _id: "RSN",  seq: 0 },
  { _id: "ACT",  seq: 0 },
  { _id: "CHN",  seq: 0 },
  { _id: "FUNC", seq: STAFF_FUNCTIONS.length },
  { _id: "LEAD", seq: 0 },
  { _id: "TASK", seq: 0 },
];

// ─── Validate Env ─────────────────────────────────────────────────────────────
function validateEnv() {
  const required = ["MONGO_URI", "OWNER_PASSWORD", "ADMIN_PASSWORD"];
  const missing  = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`\n❌  Thiếu biến môi trường bắt buộc: ${missing.join(", ")}`);
    console.error("   Hãy kiểm tra file .env trước khi chạy script này.\n");
    process.exit(1);
  }
}

// ─── Seed StaffFunctions ──────────────────────────────────────────────────────
async function seedStaffFunctions() {
  let created = 0;
  for (const fn of STAFF_FUNCTIONS) {
    const exists = await StaffFunction.findOne({ id: fn.id }).lean();
    if (!exists) {
      await StaffFunction.create(fn);
      created++;
    }
  }
  console.log(`   ✓ StaffFunctions: ${created} tạo mới, ${STAFF_FUNCTIONS.length - created} đã tồn tại`);
}

// ─── Seed Counters ────────────────────────────────────────────────────────────
async function seedCounters() {
  let created = 0;
  for (const counter of INITIAL_COUNTERS) {
    const exists = await Counter.findById(counter._id).lean();
    if (!exists) {
      await Counter.create(counter);
      created++;
    }
  }
  console.log(`   ✓ Counters: ${created} tạo mới, ${INITIAL_COUNTERS.length - created} đã tồn tại`);
}

// ─── Seed Owner ───────────────────────────────────────────────────────────────
async function seedOwner() {
  const email = (process.env.OWNER_EMAIL || "owner@company.vn").toLowerCase().trim();
  const exists = await User.findOne({ email }).lean();
  if (exists) {
    console.log(`   ⚠  Owner (${email}) đã tồn tại — bỏ qua.`);
    return;
  }
  const passwordHash = await hashPassword(process.env.OWNER_PASSWORD);
  await User.create({
    id:           "USER1",
    name:         process.env.OWNER_NAME || "Chủ hệ thống CRM",
    email,
    passwordHash,
    roleId:       "owner",
    isActive:     true,
    sessions:     [],
    createdBy:    "SYSTEM",
  });
  console.log(`   ✓ Owner tạo thành công: ${email}`);
}

// ─── Seed Admin ───────────────────────────────────────────────────────────────
async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "admin@company.vn").toLowerCase().trim();
  const exists = await User.findOne({ email }).lean();
  if (exists) {
    console.log(`   ⚠  Admin (${email}) đã tồn tại — bỏ qua.`);
    return;
  }
  const passwordHash = await hashPassword(process.env.ADMIN_PASSWORD);
  await User.create({
    id:           "USER2",
    name:         process.env.ADMIN_NAME || "Quản trị CRM",
    email,
    passwordHash,
    roleId:       "admin",
    isActive:     true,
    sessions:     [],
    createdBy:    "SYSTEM",
  });
  console.log(`   ✓ Admin tạo thành công: ${email}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  validateEnv();

  console.log("\n🔌  Kết nối MongoDB...");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log(`   Connected: ${mongoose.connection.host}\n`);

  console.log("🌱  Khởi tạo dữ liệu tối thiểu (UAT/PROD)...\n");

  // 1. RBAC: Permissions + Roles (idempotent upsert)
  console.log("📋  [1/5] Đồng bộ RBAC Permissions & Roles...");
  await seedRbac();

  // 2. StaffFunctions
  console.log("🧩  [2/5] Khởi tạo StaffFunctions...");
  await seedStaffFunctions();

  // 3. Counters
  console.log("🔢  [3/5] Khởi tạo Counters...");
  await seedCounters();

  // 4. Owner account
  console.log("👑  [4/5] Khởi tạo tài khoản Owner...");
  await seedOwner();

  // 5. Admin account
  console.log("🛡   [5/5] Khởi tạo tài khoản Admin...");
  await seedAdmin();

  console.log("\n✅  Khởi tạo UAT/PROD hoàn tất!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("⚠️  QUAN TRỌNG: Hãy đổi mật khẩu Owner & Admin");
  console.log("   ngay sau khi đăng nhập lần đầu tiên!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await mongoose.connection.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌  Khởi tạo thất bại:", err.message);
  mongoose.connection.close().then(() => process.exit(1));
});
