const Customer = require("../models/Customer");

const Event = require("../models/Event");
const Organization = require("../models/Organization");
const User = require("../models/User");
const StaffFunction = require("../models/StaffFunction");

const Action = require("../models/Action");
const Result = require("../models/Result");
const Reason = require("../models/Reason");
const ActionChain = require("../models/ActionChain");
const Counter = require("../models/Counter");
const seedData = require("../constants/seedData");
const { hashPassword } = require("../utils/auth");
const { seedRbac, migrateUsersToRbac } = require("./rbacSeed");
const { seedSystemFunnel } = require("../scripts/seedSystemFunnel");
const {
  buildDepartmentAlias,
  buildGroupAlias,
  buildOrganizationDirectory,
  resolveDepartmentReference,
  resolveGroupReference,
} = require("../utils/organization");

async function seedCollection(Model, items, label) {
  const count = await Model.countDocuments();

  if (count > 0) {
    return;
  }

  await Model.insertMany(items);
  console.log(`Seeded ${items.length} ${label}`);
}

async function seedUsers() {
  const existingUsers = await User.find({}).select({ id: 1, email: 1 }).lean();
  const existingIds = new Set(existingUsers.map((item) => item.id));
  const existingEmails = new Set(
    existingUsers
      .map((item) =>
        String(item.email || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );

  const missingSeedUsers = seedData.users.filter(
    (item) =>
      !existingIds.has(item.id) &&
      !existingEmails.has(String(item.email).trim().toLowerCase()),
  );

  if (missingSeedUsers.length === 0) {
    return;
  }

  const organizations = await Organization.find({}, { id: 1, alias: 1, parent: 1, children: 1 }).lean();
  const directory = buildOrganizationDirectory(organizations);

  const items = await Promise.all(
    missingSeedUsers.map(async (item) => {
      const resolvedDepts = (item.department || [])
        .map((d) => resolveDepartmentReference(directory, d))
        .filter(Boolean);
      const resolvedGroups = (item.group || [])
        .map((g) => resolveGroupReference(directory, g))
        .filter(Boolean);

      const deptToFuncMap = {
        "phong-marketing": "FUNC1",
        "phong-sale": "FUNC2",
        "phong-ky-thuat": "FUNC3",
        "phong-cskh": "FUNC4"
      };

      const functions = [];
      const departments = [];
      const groups = [];

      resolvedDepts.forEach(dept => {
        const functionId = deptToFuncMap[dept.alias] || "FUNC1";
        if (!functions.includes(functionId)) {
          functions.push(functionId);
        }
        departments.push({
          deptAlias: dept.alias,
          role: item.role === "MANAGER" ? "lead" : "member"
        });
      });

      resolvedGroups.forEach(grp => {
        groups.push({
          groupAlias: grp.alias,
          role: item.role === "MANAGER" ? "lead" : "member"
        });
      });

      return {
        ...item,
        email: String(item.email).trim().toLowerCase(),
        roleId: String(item.role || "STAFF")
          .trim()
          .toLowerCase(),
        passwordHash: await hashPassword(item.password),
        password: undefined,
        sessions: [],
        lastLoginAt: null,
        createdBy: null,
        functions,
        departments,
        groups,
      };
    })
  );

  await User.insertMany(items.map(({ password, role, ...item }) => item));
  console.log(`Seeded ${items.length} users`);
}

async function syncOrganizationAliases() {
  const organizations = await Organization.find();
  let updated = 0;

  for (const organization of organizations) {
    const nextAlias =
      organization.alias || buildDepartmentAlias(organization.parent);
    let changed = organization.alias !== nextAlias;

    organization.alias = nextAlias;
    organization.children = organization.children.map((child) => {
      const nextChildAlias =
        child.alias || buildGroupAlias(nextAlias, child.name);

      if (child.alias !== nextChildAlias) {
        changed = true;
      }

      return {
        ...child.toObject(),
        alias: nextChildAlias,
      };
    });

    if (changed) {
      await organization.save();
      updated += 1;
    }
  }

  if (updated > 0) {
    console.log(`Synced ${updated} organizations with aliases`);
  }
}

async function syncUserOrganizationReferences() {
  const organizations = await Organization.find(
    {},
    { id: 1, alias: 1, parent: 1, children: 1 },
  ).lean();
  const directory = buildOrganizationDirectory(organizations);
  const users = await User.find();
  let updated = 0;

  for (const user of users) {
    if (Array.isArray(user.departments) && user.departments.length > 0) {
      continue;
    }

    const legacyDept = user.toObject().department || [];
    const legacyGroup = user.toObject().group || [];

    if (legacyDept.length > 0 || legacyGroup.length > 0) {
      const resolvedDepts = legacyDept
        .map((item) => resolveDepartmentReference(directory, item))
        .filter(Boolean);
      const resolvedGroups = legacyGroup
        .map((item) => resolveGroupReference(directory, item))
        .filter(Boolean);

      const deptToFuncMap = {
        "phong-marketing": "FUNC1",
        "phong-sale": "FUNC2",
        "phong-ky-thuat": "FUNC3",
        "phong-cskh": "FUNC4"
      };

      const functions = [];
      const departments = [];
      const groups = [];

      resolvedDepts.forEach(dept => {
        const functionId = deptToFuncMap[dept.alias] || "FUNC1";
        if (!functions.includes(functionId)) {
          functions.push(functionId);
        }
        departments.push({ deptAlias: dept.alias, role: user.roleId === "manager" ? "lead" : "member" });
      });

      resolvedGroups.forEach(g => {
        groups.push({ groupAlias: g.alias, role: user.roleId === "manager" ? "lead" : "member" });
      });

      user.functions = functions;
      user.departments = departments;
      user.groups = groups;
      await user.save();
      updated += 1;
    }
  }

  if (updated > 0) {
    console.log(`Synced ${updated} users to decoupled structure`);
  }
}

async function seedDatabase() {
  await seedCollection(Organization, seedData.organizations, "organization items");
  await syncOrganizationAliases();
  await seedUsers();
  await syncUserOrganizationReferences();
  await seedCollection(Customer, seedData.customers, "customers");

  await seedCollection(Event, seedData.events, "events");
  await seedCollection(StaffFunction, seedData.staffFunctions, "staff functions");

  // ── Action config — thứ tự: Reason → Result → Action → ActionChain ──────
  await seedCollection(Reason, seedData.reasons, "reasons");
  await seedCollection(Result, seedData.results, "results");
  await seedCollection(Action, seedData.actions, "actions");
  await seedCollection(ActionChain, seedData.actionChains, "action chains");

  // Seed RBAC
  await seedRbac();

  // Migrate existing users to RBAC
  // await migrateUsersToRbac();

  // Seed counters if not present (ensures monotonic IDs start correctly)
  await seedCounters();

  // Seed system funnel (idempotent)
  await seedSystemFunnel();
}

/**
 * Initialize counters based on existing max IDs in collections.
 * Only creates counter entries that don't already exist.
 */
async function seedCounters() {
  const prefixConfigs = [
    { prefix: "USER", items: seedData.users },
    { prefix: "CUST", items: seedData.customers },
    { prefix: "EVT", items: seedData.events },
    { prefix: "RES", items: seedData.results },
    { prefix: "RSN", items: seedData.reasons },
    { prefix: "ACT", items: seedData.actions },
    { prefix: "CHN", items: seedData.actionChains },
    { prefix: "FUNC", items: seedData.staffFunctions },
    { prefix: "ORG", items: seedData.organizations }

  ];

  let seeded = 0;
  for (const { prefix, items } of prefixConfigs) {
    const existing = await Counter.findById(prefix);
    if (!existing) {
      await Counter.create({ _id: prefix, seq: items.length });
      seeded++;
    }
  }

  if (seeded > 0) {
    console.log(`Seeded ${seeded} counters`);
  }
}

module.exports = {
  seedDatabase,
};
