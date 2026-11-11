const ModuleConfigService = require('../../modules/system/moduleConfig/moduleConfig.service');
const { SIDEBAR_SYSTEM_MODULES } = require('../constants/rbac');
const { sendError } = require('../utils/http');

/**
 * Middleware chặn request tới các phân hệ (module) đã bị Owner/Admin tắt trên toàn hệ thống.
 * Áp dụng cho toàn bộ user (kể cả OWNER, ADMIN, MANAGER, STAFF).
 */
function requireActiveModule(moduleKey) {
  return async (_req, res, next) => {
    const isEnabled = await ModuleConfigService.isModuleEnabled(moduleKey);

    if (!isEnabled) {
      const moduleInfo = SIDEBAR_SYSTEM_MODULES[moduleKey];
      const moduleLabel = moduleInfo ? moduleInfo.label : moduleKey;

      return sendError(
        res,
        403,
        `Phân hệ "${moduleLabel}" hiện đang bị tắt bởi Quản trị viên.`,
        {
          code: 'MODULE_DISABLED',
          details: {
            moduleKey,
            moduleLabel,
          },
        },
      );
    }

    return next();
  };
}

module.exports = {
  requireActiveModule,
};

