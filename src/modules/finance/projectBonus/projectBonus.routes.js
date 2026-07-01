const express = require('express');
const router = express.Router();
const projectBonusController = require('./projectBonus.controller');
const { protect } = require('../../../middlewares/auth');

router.use(protect); // Ensure user is authenticated

router.route('/')
  .get(projectBonusController.getAllProjectBonuses)
  .post(projectBonusController.createProjectBonus);

router.route('/:id')
  .get(projectBonusController.getProjectBonusById)
  .put(projectBonusController.updateProjectBonus)
  .delete(projectBonusController.deleteProjectBonus);

module.exports = router;
