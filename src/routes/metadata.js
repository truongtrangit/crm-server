const express = require("express");
const Organization = require("../models/Organization");
const {
  PLATFORMS,
  CUSTOMER_GROUPS,
  CUSTOMER_TYPES,
  STAFF_ROLES,
} = require("../constants/appData");

const router = express.Router();

async function getDerivedMetadata() {
  const departments = await Organization.find()
    .sort({ createdAt: 1, id: 1 })
    .lean();
  const groups = departments.flatMap((item) =>
    item.children.map((child) => child.name),
  );

  return {
    platforms: PLATFORMS,
    customerGroups: groups.length > 0 ? groups : CUSTOMER_GROUPS,
    customerTypes: CUSTOMER_TYPES,
    staffRoles: STAFF_ROLES,
    departments: departments.map((item) => item.parent),
  };
}

router.get("/", async (_req, res) => {
  const metadata = await getDerivedMetadata();
  res.json(metadata);
});

router.get("/roles", async (_req, res) => {
  res.json(STAFF_ROLES);
});

router.get("/departments", async (_req, res) => {
  const metadata = await getDerivedMetadata();
  res.json(metadata.departments);
});

router.get("/customer-groups", async (_req, res) => {
  const metadata = await getDerivedMetadata();
  res.json(metadata.customerGroups);
});

module.exports = router;
