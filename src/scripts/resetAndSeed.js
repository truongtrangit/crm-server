/**
 * resetAndSeed.js — Xoá toàn bộ data và seed lại từ đầu
 *
 * Chạy: node src/scripts/resetAndSeed.js
 *
 * ⚠️  CẢNH BÁO: script này XOÁ HOÀN TOÀN tất cả collections trước khi seed.
 *     CHỈ dùng trong môi trường DEV.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");

// ─── Models ───
const Customer        = require("../models/Customer");
const Lead            = require("../models/Lead");
const Event           = require("../models/Event");
const Organization    = require("../models/Organization");
const User            = require("../models/User");
const StaffFunction   = require("../models/StaffFunction");
const Task            = require("../models/Task");
const Action          = require("../models/Action");
const Result          = require("../models/Result");
const Reason          = require("../models/Reason");
const ActionChain     = require("../models/ActionChain");
const EventActionChain = require("../models/EventActionChain");
const Role            = require("../models/Role");

// ─── Seed helpers ───
const seedData = require("../constants/seedData");
const { hashPassword } = require("../utils/auth");
const { seedRbac } = require("../services/rbacSeed");
const {
  buildDepartmentAlias,
  buildGroupAlias,
  buildOrganizationDirectory,
  resolveDepartmentReference,
  resolveGroupReference,
} = require("../utils/organization");

const MODELS_TO_RESET = [
  { model: EventActionChain, name: "EventActionChain" },
  { model: Event,            name: "Event" },
  { model: Customer,         name: "Customer" },
  { model: Lead,             name: "Lead" },
  { model: Task,             name: "Task" },
  { model: ActionChain,      name: "ActionChain" },
  { model: Action,           name: "Action" },
  { model: Result,           name: "Result" },
  { model: Reason,           name: "Reason" },
  { model: StaffFunction,    name: "StaffFunction" },
  { model: Organization,     name: "Organization" },
  { model: User,             name: "User" },
  { model: Role,             name: "Role" },
];

async function dropAll() {
  console.log("\n🗑  Dropping all collections...");
  for (const { model, name } of MODELS_TO_RESET) {
    try {
      await model.deleteMany({});
      console.log(`   ✓ Cleared: ${name}`);
    } catch (e) {
      console.warn(`   ⚠ Could not clear ${name}: ${e.message}`);
    }
  }
}

async function seedOrganizations() {
  for (const org of seedData.organizations) {
    const alias = buildDepartmentAlias(org.parent);
    const children = org.children.map((child) => ({
      ...child,
      alias: buildGroupAlias(alias, child.name),
    }));
    await Organization.create({ ...org, alias, children });
  }
  console.log(`   ✓ Seeded ${seedData.organizations.length} organizations`);
}

async function seedUsers() {
  const organizations = await Organization.find({}, { id: 1, alias: 1, parent: 1, children: 1 }).lean();
  const directory = buildOrganizationDirectory(organizations);

  const items = await Promise.all(
    seedData.users.map(async (item) => {
      const resolvedDepts = (item.department || [])
        .map((d) => resolveDepartmentReference(directory, d))
        .filter(Boolean);
      const resolvedGroups = (item.group || [])
        .map((g) => resolveGroupReference(directory, g))
        .filter(Boolean);

      return {
        ...item,
        email: String(item.email).trim().toLowerCase(),
        roleId: String(item.role || "STAFF").trim().toLowerCase(),
        passwordHash: await hashPassword(item.password),
        password:    undefined,
        sessions:    [],
        lastLoginAt: null,
        createdBy:   null,
        departmentAliases: [...new Set(resolvedDepts.map((d) => d.alias))],
        groupAliases:      [...new Set(resolvedGroups.map((g) => g.alias))],
      };
    })
  );

  await User.insertMany(items.map(({ password, role, ...rest }) => rest));
  console.log(`   ✓ Seeded ${items.length} users`);
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌  MONGO_URI not found in .env");
    process.exit(1);
  }

  console.log("🔌  Connecting to MongoDB...");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`   Connected: ${mongoose.connection.host}`);

  // ── 1. Drop all ──────────────────────────────────────────
  await dropAll();

  // ── 2. Seed in dependency order ──────────────────────────
  console.log("\n🌱  Seeding fresh data...");

  await seedOrganizations();
  await seedUsers();

  await Result.insertMany(seedData.results);
  console.log(`   ✓ Seeded ${seedData.results.length} results`);

  await Reason.insertMany(seedData.reasons);
  console.log(`   ✓ Seeded ${seedData.reasons.length} reasons`);

  await Action.insertMany(seedData.actions);
  console.log(`   ✓ Seeded ${seedData.actions.length} actions`);

  await ActionChain.insertMany(seedData.actionChains);
  console.log(`   ✓ Seeded ${seedData.actionChains.length} action chains`);

  await Customer.insertMany(seedData.customers);
  console.log(`   ✓ Seeded ${seedData.customers.length} customers`);

  // Enrich event assignee snapshots with department/group from the seeded users
  const seededUsers = await User.find({}, { id: 1, name: 1, avatar: 1, department: 1, group: 1, roleId: 1 }).lean();
  const userMap = Object.fromEntries(seededUsers.map(u => [u.id, u]));

  const enrichedEvents = seedData.events.map(evt => {
    if (!evt.assigneeId) return evt;
    const u = userMap[evt.assigneeId];
    if (!u) return evt;
    return {
      ...evt,
      assignee: {
        ...(evt.assignee || {}),
        name:       u.name       || evt.assignee?.name       || '',
        avatar:     u.avatar     || evt.assignee?.avatar      || '',
        department: u.department || [],
        group:      u.group      || [],
      },
    };
  });

  await Event.insertMany(enrichedEvents);
  console.log(`   ✓ Seeded ${enrichedEvents.length} events`);

  await StaffFunction.insertMany(seedData.staffFunctions);
  console.log(`   ✓ Seeded ${seedData.staffFunctions.length} staff functions`);

  // ── 3. Seed RBAC roles ──────────────────────────────────
  await seedRbac();
  console.log("   ✓ RBAC roles seeded");

  console.log("\n✅  Reset & seed completed successfully!\n");

  await mongoose.connection.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌  Reset failed:", err.message);
  mongoose.connection.close().then(() => process.exit(1));
});
