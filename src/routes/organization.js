const express = require("express");
const Organization = require("../models/Organization");
const { sendError, sendSuccess } = require("../utils/http");
const {
  buildPaginatedResponse,
  resolvePagination,
} = require("../utils/pagination");
const { requirePermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../constants/rbac");
const {
  buildDepartmentAlias,
  buildGroupAlias,
} = require("../utils/organization");

const router = express.Router();

router.get(
  "/",
  requirePermission(PERMISSIONS.ORGANIZATION_READ),
  async (req, res) => {
    const { page, limit, skip } = resolvePagination(req.query || {});
    const [organization, totalItems] = await Promise.all([
      Organization.find().sort({ createdAt: 1, id: 1 }).skip(skip).limit(limit),
      Organization.countDocuments(),
    ]);

    return sendSuccess(
      res,
      200,
      "Get organization list success",
      buildPaginatedResponse(organization, totalItems, page, limit),
    );
  },
);

router.post(
  "/departments",
  requirePermission(PERMISSIONS.ORGANIZATION_UPDATE),
  async (req, res) => {
    const { name, alias: rawAlias } = req.body || {};
    const alias = rawAlias || buildDepartmentAlias(name);

    if (!name) {
      return sendError(res, 400, "name is required", {
        code: "VALIDATION_ERROR",
      });
    }

    if (!alias) {
      return sendError(res, 400, "alias is invalid", {
        code: "VALIDATION_ERROR",
      });
    }

    const existingDepartment = await Organization.findOne({
      $or: [{ parent: name }, { alias }],
    });

    if (existingDepartment) {
      return sendError(res, 409, "Department already exists", {
        code: "DEPARTMENT_ALREADY_EXISTS",
      });
    }

    const nextId = String((await Organization.countDocuments()) + 1);
    const department = await Organization.create({
      id: nextId,
      alias,
      parent: name,
      children: [],
    });

    return sendSuccess(res, 201, "Create department success", department);
  },
);

router.post(
  "/groups",
  requirePermission(PERMISSIONS.ORGANIZATION_UPDATE),
  async (req, res) => {
    const {
      name,
      desc = "",
      parentId,
      parentAlias,
      alias: rawAlias,
    } = req.body || {};

    if (!name || (!parentId && !parentAlias)) {
      return sendError(res, 400, "name and parentId/parentAlias are required", {
        code: "VALIDATION_ERROR",
      });
    }

    const department = await Organization.findOne({
      $or: [{ id: parentId }, { alias: parentAlias }],
    });

    if (!department) {
      return sendError(res, 404, "Department not found", {
        code: "DEPARTMENT_NOT_FOUND",
      });
    }

    const departmentAlias =
      department.alias || buildDepartmentAlias(department.parent);
    const alias = rawAlias || buildGroupAlias(departmentAlias, name);

    if (!alias) {
      return sendError(res, 400, "alias is invalid", {
        code: "VALIDATION_ERROR",
      });
    }

    const duplicatedGroup = department.children.find(
      (item) => item.name === name || item.alias === alias,
    );

    if (duplicatedGroup) {
      return sendError(res, 409, "Group already exists", {
        code: "GROUP_ALREADY_EXISTS",
      });
    }

    department.children.push({ name, desc, alias });
    await department.save();

    return sendSuccess(res, 201, "Create group success", {
      alias,
      name,
      desc,
      parentId: department.id,
      parentAlias: departmentAlias,
    });
  },
);

module.exports = router;
