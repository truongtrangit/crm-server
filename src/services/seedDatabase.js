const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const Organization = require("../models/Organization");
const Staff = require("../models/Staff");
const StaffFunction = require("../models/StaffFunction");
const Task = require("../models/Task");
const seedData = require("../constants/seedData");

async function seedCollection(Model, items, label) {
  const count = await Model.countDocuments();

  if (count > 0) {
    return;
  }

  await Model.insertMany(items);
  console.log(`Seeded ${items.length} ${label}`);
}

async function seedDatabase() {
  await seedCollection(
    Organization,
    seedData.organizations,
    "organization items",
  );
  await seedCollection(Staff, seedData.staff, "staff members");
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
