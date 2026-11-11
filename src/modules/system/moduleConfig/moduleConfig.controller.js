const ModuleConfigService = require('./moduleConfig.service');
const SystemLogService = require('../log/systemLog.service');
const { RESOURCES, SIDEBAR_SYSTEM_MODULES } = require('../../../core/constants/rbac');
const { sendSuccess } = require('../../../core/utils/http');

class ModuleConfigController {
  async getConfig(req, res) {
    const config = await ModuleConfigService.getModuleConfig();
    return sendSuccess(res, 200, 'Lấy cấu hình module thành công', config);
  }

  async updateConfig(req, res) {
    const { config, changes } = await ModuleConfigService.updateModuleConfig(req.body, req.user);

    const changedDescriptions = Object.entries(changes || {}).map(([key, diff]) => {
      const label = SIDEBAR_SYSTEM_MODULES[key]?.label || key;
      const statusText = diff.to ? 'Bật' : 'Tắt';
      return `${label}: ${statusText}`;
    });

    const detailSummary =
      changedDescriptions.length > 0
        ? ` (${changedDescriptions.join(', ')})`
        : '';

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.SYSTEM_MODULES,
      resourceId: 'sidebar_modules',
      resourceName: 'Cấu hình Module Sidebar',
      description: `Cập nhật trạng thái bật/tắt module trên Sidebar${detailSummary}`,
      metadata: { changes },
      req,
    });

    return sendSuccess(res, 200, 'Cập nhật cấu hình module thành công', config);
  }
}

module.exports = new ModuleConfigController();

