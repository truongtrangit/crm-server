const express = require('express');
const { requireRole } = require('../../core/middleware/auth');
const validate = require('../../core/middleware/validate');
const { USER_ROLE_VALUES } = require('../../core/constants/appData');
const { updateModuleConfigSchema } = require('../../modules/system/moduleConfig/moduleConfig.validation');
const ModuleConfigController = require('../../modules/system/moduleConfig/moduleConfig.controller');

const router = express.Router();

router.get('/', ModuleConfigController.getConfig);

router.put(
  '/',
  requireRole([USER_ROLE_VALUES.OWNER, USER_ROLE_VALUES.ADMIN]),
  validate(updateModuleConfigSchema),
  ModuleConfigController.updateConfig,
);

module.exports = router;

