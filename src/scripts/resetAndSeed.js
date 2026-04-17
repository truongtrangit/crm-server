/**
 * resetAndSeed.js
 *
 * Xóa sạch toàn bộ data test và seed lại bộ data mới.
 * Chỉ dùng trong môi trường development!
 *
 * Chạy: node src/scripts/resetAndSeed.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

// ─── Models cần reset ────────────────────────────────────────────────────────
const Customer      = require("../models/Customer");
const Lead          = require("../models/Lead");
const Event         = require("../models/Event");
const EventActionChain = require("../models/EventActionChain");
const Organization  = require("../models/Organization");
const User          = require("../models/User");
const StaffFunction = require("../models/StaffFunction");
const Task          = require("../models/Task");
const Action        = require("../models/Action");
const Result        = require("../models/Result");
const Reason        = require("../models/Reason");
const ActionChain   = require("../models/ActionChain");
const Role          = require("../models/Role");
const Permission    = require("../models/Permission");

const { seedDatabase } = require("../services/seedDatabase");

const COLLECTIONS_TO_CLEAR = [
  { model: EventActionChain, name: "EventActionChain" },
  { model: Event,            name: "Event" },
  { model: Customer,         name: "Customer" },
  { model: Lead,             name: "Lead" },
  { model: Task,             name: "Task" },
  { model: StaffFunction,    name: "StaffFunction" },
  { model: ActionChain,      name: "ActionChain" },
  { model: Action,           name: "Action" },
  { model: Result,           name: "Result" },
  { model: Reason,           name: "Reason" },
  { model: User,             name: "User" },
  { model: Organization,     name: "Organization" },
  { model: Role,             name: "Role" },
  { model: Permission,       name: "Permission" },
];

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌  MONGO_URI not found in .env");
    process.exit(1);
  }

  if (!mongoUri.includes("localhost") && !mongoUri.includes("127.0.0.1") && !mongoUri.includes("atlas")) {
    // Safety guard: chỉ được chạy với URI rõ ràng là dev/test
    const isProd = process.env.NODE_ENV === "production";
    if (isProd) {
      console.error("❌  TỪCHỐI: NODE_ENV=production. Script chỉ chạy trong môi trường dev.");
      process.exit(1);
    }
  }

  await mongoose.connect(mongoUri);
  console.log("✅  Kết nối MongoDB thành công\n");

  // ── 1. Xóa sạch ──────────────────────────────────────────────────────────
  console.log("🗑️   Đang xóa dữ liệu cũ...");
  for (const { model, name } of COLLECTIONS_TO_CLEAR) {
    const result = await model.deleteMany({});
    console.log(`    ${name}: đã xóa ${result.deletedCount} documents`);
  }
  console.log("");

  // ── 2. Seed lại ──────────────────────────────────────────────────────────
  console.log("🌱  Đang seed dữ liệu mới...");
  await seedDatabase();
  console.log("");

  console.log("✅  Reset & Seed hoàn tất!");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌  Lỗi:", err.message);
  process.exit(1);
});
