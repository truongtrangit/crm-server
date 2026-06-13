const express = require("express");
const router = express.Router();
const FunctionalGroupController = require('../../modules/hr/functionalGroup/functionalGroup.controller');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');
const validate = require('../../core/middleware/validate');
const { createFunctionalGroupSchema, updateFunctionalGroupSchema } = require('../../modules/hr/functionalGroup/functionalGroups.validation');

router.get("/", requirePermission(PERMISSIONS.FUNCTIONAL_GROUPS_READ), FunctionalGroupController.getGroups);
router.post("/", requirePermission(PERMISSIONS.FUNCTIONAL_GROUPS_CREATE), validate(createFunctionalGroupSchema), FunctionalGroupController.createGroup);
router.put("/:id", requirePermission(PERMISSIONS.FUNCTIONAL_GROUPS_UPDATE), validate(updateFunctionalGroupSchema), FunctionalGroupController.updateGroup);
router.delete("/:id", requirePermission(PERMISSIONS.FUNCTIONAL_GROUPS_DELETE), FunctionalGroupController.deleteGroup);

module.exports = router;
