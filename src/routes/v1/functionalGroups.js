const express = require("express");
const router = express.Router();
const FunctionalGroupController = require("../../controllers/FunctionalGroupController");
const { requirePermission } = require("../../middleware/auth");
const { PERMISSIONS } = require("../../constants/rbac");
const validate = require("../../middleware/validate");
const { createFunctionalGroupSchema, updateFunctionalGroupSchema } = require("../../validations/functionalGroups");

router.get("/", requirePermission(PERMISSIONS.FUNCTIONAL_GROUPS_READ), FunctionalGroupController.getGroups);
router.post("/", requirePermission(PERMISSIONS.FUNCTIONAL_GROUPS_CREATE), validate(createFunctionalGroupSchema), FunctionalGroupController.createGroup);
router.put("/:id", requirePermission(PERMISSIONS.FUNCTIONAL_GROUPS_UPDATE), validate(updateFunctionalGroupSchema), FunctionalGroupController.updateGroup);
router.delete("/:id", requirePermission(PERMISSIONS.FUNCTIONAL_GROUPS_DELETE), FunctionalGroupController.deleteGroup);

module.exports = router;
