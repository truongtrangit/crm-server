const express = require("express");
const Organization = require("../models/Organization");
const { paginateArray } = require("../utils/pagination");
const { sendSuccess } = require("../utils/http");
const {
  PLATFORMS,
  CUSTOMER_GROUPS,
  CUSTOMER_TYPES,
  USER_ROLES,
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
    staffRoles: USER_ROLES,
    userRoles: USER_ROLES,
    departments: departments.map((item) => item.parent),
  };
}

router.get("/", async (_req, res) => {
  const metadata = await getDerivedMetadata();
  return sendSuccess(res, 200, "Get metadata success", metadata);
});

router.get("/roles", async (req, res) => {
  return sendSuccess(
    res,
    200,
    "Get roles success",
    paginateArray(USER_ROLES, req.query || {}),
  );
});

router.get("/departments", async (req, res) => {
  const metadata = await getDerivedMetadata();
  return sendSuccess(
    res,
    200,
    "Get departments success",
    paginateArray(metadata.departments, req.query || {}),
  );
});

router.get("/customer-groups", async (req, res) => {
  const metadata = await getDerivedMetadata();
  return sendSuccess(
    res,
    200,
    "Get customer groups success",
    paginateArray(metadata.customerGroups, req.query || {}),
  );
});

module.exports = router;
