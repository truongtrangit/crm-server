const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const Organization = require("../models/Organization");
const User = require("../models/User");
const StaffFunction = require("../models/StaffFunction");
const Task = require("../models/Task");
const seedData = require("../constants/seedData");
const { hashPassword } = require("../utils/auth");

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

  const items = await Promise.all(
    missingSeedUsers.map(async (item) => ({
      ...item,
      email: String(item.email).trim().toLowerCase(),
      passwordHash: await hashPassword(item.password),
      password: undefined,
      sessions: [],
      lastLoginAt: null,
      createdBy: null,
    })),
  );

  await User.insertMany(items.map(({ password, ...item }) => item));
  console.log(`Seeded ${items.length} users`);
}

async function seedDatabase() {
  await seedCollection(
    Organization,
    seedData.organizations,
    "organization items",
  );
  await seedUsers();
  await seedCollection(Customer, seedData.customers, "customers");
  await seedCollection(Lead, seedData.leads, "leads");
  await seedCollection(Task, seedData.tasks, "tasks");
  await seedCollection(
    StaffFunction,
    seedData.staffFunctions,
    "staff functions",
  );
}

module.exports = {
  seedDatabase,
};
