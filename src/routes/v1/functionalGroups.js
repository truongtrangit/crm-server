const express = require("express");
const router = express.Router();
const FunctionalGroupController = require("../../controllers/FunctionalGroupController");
const { requireRole } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { createFunctionalGroupSchema, updateFunctionalGroupSchema } = require("../../validations/functionalGroups");

// Only Admin/Owner can manage functional groups
router.use(requireRole(["OWNER", "ADMIN"]));

router.get("/", FunctionalGroupController.getGroups);
router.post("/", validate(createFunctionalGroupSchema), FunctionalGroupController.createGroup);
router.put("/:id", validate(updateFunctionalGroupSchema), FunctionalGroupController.updateGroup);
router.delete("/:id", FunctionalGroupController.deleteGroup);

module.exports = router;
