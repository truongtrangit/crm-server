const mongoose = require("mongoose");
const env = require("../config/env");
const User = require("../models/User");
const { hashPassword } = require("../utils/auth");
const {
  USER_ROLE_VALUES,
  getUserRoleRank,
  normalizeUserRole,
} = require("../utils/userRoles");

const LEGACY_STAFF_COLLECTION_NAME = "staffs";
const USER_ID_PREFIX = "USER";

function padNumber(value, width = 3) {
  return String(value).padStart(width, "0");
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeString(item)).filter(Boolean);
}

function mapLegacyRole(role) {
  return normalizeUserRole(role, USER_ROLE_VALUES.STAFF);
}

function createGeneratedUserIdFactory(existingIds) {
  let currentNumber = Array.from(existingIds).reduce((maxNumber, id) => {
    if (!String(id).startsWith(USER_ID_PREFIX)) {
      return maxNumber;
    }

    const numericValue = Number(String(id).replace(/\D/g, "")) || 0;
    return Math.max(maxNumber, numericValue);
  }, 0);

  return () => {
    currentNumber += 1;
    return `${USER_ID_PREFIX}${padNumber(currentNumber)}`;
  };
}

function sortLegacyStaffForMigration(items) {
  return [...items].sort(
    (left, right) =>
      getUserRoleRank(mapLegacyRole(right.role)) -
      getUserRoleRank(mapLegacyRole(left.role)),
  );
}

async function getLegacyStaffCollection() {
  const db = mongoose.connection.db;

  if (!db) {
    return null;
  }

  const collections = await db
    .listCollections({ name: LEGACY_STAFF_COLLECTION_NAME }, { nameOnly: true })
    .toArray();

  if (collections.length === 0) {
    return null;
  }

  return db.collection(LEGACY_STAFF_COLLECTION_NAME);
}

function findManagerId(managers, department, group) {
  const matchedByGroup = managers.find((manager) =>
    group.some((item) => manager.group.includes(item)),
  );

  if (matchedByGroup) {
    return matchedByGroup.id;
  }

  const matchedByDepartment = managers.find((manager) =>
    department.some((item) => manager.department.includes(item)),
  );

  return matchedByDepartment?.id || null;
}

async function buildMigratedUsers(legacyStaffs, existingUsers) {
  const itemsToInsert = [];
  const existingIds = new Set(
    existingUsers.map((item) => item.id).filter(Boolean),
  );
  const existingEmails = new Set(
    existingUsers
      .map((item) => normalizeString(item.email).toLowerCase())
      .filter(Boolean),
  );
  const managers = existingUsers
    .filter((item) => item.role === USER_ROLE_VALUES.MANAGER)
    .map((item) => ({
      id: item.id,
      department: normalizeStringList(item.department),
      group: normalizeStringList(item.group),
    }));
  const nextGeneratedUserId = createGeneratedUserIdFactory(existingIds);

  for (const legacyStaff of sortLegacyStaffForMigration(legacyStaffs)) {
    const email = normalizeString(legacyStaff.email).toLowerCase();
    const legacyId = normalizeString(legacyStaff.id);

    if (!email) {
      continue;
    }

    if (existingEmails.has(email) || (legacyId && existingIds.has(legacyId))) {
      continue;
    }

    const role = mapLegacyRole(legacyStaff.role);
    const nextId = legacyId || nextGeneratedUserId();

    const department = normalizeStringList(legacyStaff.department);
    const group = normalizeStringList(legacyStaff.group);
    const user = {
      id: nextId,
      name: normalizeString(legacyStaff.name) || email,
      email,
      passwordHash: await hashPassword(env.migratedUserDefaultPassword),
      avatar: normalizeString(legacyStaff.avatar),
      department,
      group,
      phone: normalizeString(legacyStaff.phone),
      role,
      managerId:
        role === USER_ROLE_VALUES.STAFF
          ? findManagerId(managers, department, group)
          : null,
      createdBy: null,
      lastLoginAt: null,
      sessions: [],
      createdAt: legacyStaff.createdAt || new Date(),
      updatedAt: legacyStaff.updatedAt || new Date(),
    };

    itemsToInsert.push(user);
    existingIds.add(user.id);
    existingEmails.add(user.email);

    if (user.role === USER_ROLE_VALUES.MANAGER) {
      managers.push({
        id: user.id,
        department: user.department,
        group: user.group,
      });
    }
  }

  return itemsToInsert;
}

async function backfillStaffManagers() {
  const managers = await User.find({ role: USER_ROLE_VALUES.MANAGER })
    .select({ id: 1, department: 1, group: 1 })
    .lean();

  if (managers.length === 0) {
    return 0;
  }

  const staffUsers = await User.find({
    role: USER_ROLE_VALUES.STAFF,
    $or: [{ managerId: null }, { managerId: { $exists: false } }],
  });

  let updatedCount = 0;

  for (const staffUser of staffUsers) {
    const managerId = findManagerId(
      managers,
      normalizeStringList(staffUser.department),
      normalizeStringList(staffUser.group),
    );

    if (!managerId) {
      continue;
    }

    staffUser.managerId = managerId;
    await staffUser.save();
    updatedCount += 1;
  }

  return updatedCount;
}

async function cleanLegacyStaffCollection(collection) {
  if (!env.cleanLegacyStaffCollection || !collection) {
    return false;
  }

  await collection.drop();
  return true;
}

async function migrateLegacyStaffs() {
  const collection = await getLegacyStaffCollection();

  if (!collection) {
    return {
      migratedCount: 0,
      cleaned: false,
      skippedCount: 0,
      managerBackfilledCount: 0,
    };
  }

  const legacyStaffs = await collection.find({}).toArray();

  if (legacyStaffs.length === 0) {
    return {
      migratedCount: 0,
      cleaned: await cleanLegacyStaffCollection(collection),
      skippedCount: 0,
      managerBackfilledCount: 0,
    };
  }

  const existingUsers = await User.find({})
    .select({ id: 1, email: 1, role: 1, department: 1, group: 1 })
    .lean();
  const itemsToInsert = await buildMigratedUsers(legacyStaffs, existingUsers);

  if (itemsToInsert.length > 0) {
    await User.insertMany(itemsToInsert);
  }

  const managerBackfilledCount = await backfillStaffManagers();
  const cleaned = await cleanLegacyStaffCollection(collection);

  if (itemsToInsert.length > 0) {
    console.log(
      `Migrated ${itemsToInsert.length} legacy staff records into users`,
    );
  }

  if (managerBackfilledCount > 0) {
    console.log(
      `Backfilled managerId for ${managerBackfilledCount} staff users`,
    );
  }

  if (cleaned) {
    console.log("Cleaned legacy staffs collection");
  }

  return {
    migratedCount: itemsToInsert.length,
    cleaned,
    skippedCount: legacyStaffs.length - itemsToInsert.length,
    managerBackfilledCount,
  };
}

module.exports = {
  backfillStaffManagers,
  migrateLegacyStaffs,
};
