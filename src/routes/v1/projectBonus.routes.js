const { Router } = require('express');
const projectBonusController = require('../../modules/finance/projectBonus/projectBonus.controller');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');

const projectBonusRouter = Router();

// Define RBAC permissions if needed (using basic ones for now, can adjust later)
projectBonusRouter.get(
  '/',
  requirePermission(PERMISSIONS.PROJECT_BONUS_READ),
  projectBonusController.getAllProjectBonuses.bind(projectBonusController),
);

projectBonusRouter.post(
  '/',
  requirePermission(PERMISSIONS.PROJECT_BONUS_CREATE),
  projectBonusController.createProjectBonus.bind(projectBonusController),
);

projectBonusRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.PROJECT_BONUS_READ),
  projectBonusController.getProjectBonusById.bind(projectBonusController),
);

projectBonusRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.PROJECT_BONUS_UPDATE),
  projectBonusController.updateProjectBonus.bind(projectBonusController),
);

projectBonusRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.PROJECT_BONUS_DELETE),
  projectBonusController.deleteProjectBonus.bind(projectBonusController),
);

module.exports = projectBonusRouter;
