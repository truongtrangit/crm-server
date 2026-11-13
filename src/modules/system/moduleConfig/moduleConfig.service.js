const ModuleConfig = require('./moduleConfig.model');
const CacheService = require('../../../core/services/CacheService');
const { CACHE_TTL } = require('../../../core/constants/cache');
const { SIDEBAR_SYSTEM_MODULES } = require('../../../core/constants/rbac');
const { computeChanges } = require('../../../core/utils/diff');
const { createHttpError } = require('../../../core/utils/http');

const MODULE_CONFIG_CACHE_KEY = 'system:module_config';

function buildDefaultModulesMap() {
  return Object.keys(SIDEBAR_SYSTEM_MODULES).reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});
}

class ModuleConfigService {
  async getModuleConfig() {
    const cached = await CacheService.get(MODULE_CONFIG_CACHE_KEY);
    if (cached && cached.modules) {
      return cached;
    }

    let doc = await ModuleConfig.findOne().lean();
    if (!doc) {
      const created = await ModuleConfig.create({
        modules: buildDefaultModulesMap(),
      });
      doc = created.toObject();
    }

    const normalized = {
      modules: {
        ...buildDefaultModulesMap(),
        ...(doc.modules || {}),
        staff: true, // Core module cannot be disabled
      },
      updatedBy: doc.updatedBy || null,
      updatedAt: doc.updatedAt || null,
    };

    await CacheService.set(MODULE_CONFIG_CACHE_KEY, normalized, CACHE_TTL.LONG);
    return normalized;
  }

  async isModuleEnabled(moduleKey) {
    if (!moduleKey || moduleKey === 'staff') {
      return true;
    }
    const config = await this.getModuleConfig();
    return config.modules?.[moduleKey] !== false;
  }

  async updateModuleConfig(payload, user) {
    const incomingModules = payload?.modules || {};

    if (incomingModules.staff === false) {
      throw createHttpError(400, 'Phân hệ Nhân viên là phân hệ mặc định của hệ thống và không thể tắt.', {
        code: 'CORE_MODULE_CANNOT_BE_DISABLED',
      });
    }

    let doc = await ModuleConfig.findOne();
    if (!doc) {
      doc = new ModuleConfig({
        modules: buildDefaultModulesMap(),
      });
    }

    const oldModules = {
      ...buildDefaultModulesMap(),
      ...(doc.modules ? doc.modules.toObject?.() || doc.modules : {}),
    };

    const nextModules = { ...oldModules };
    for (const key of Object.keys(SIDEBAR_SYSTEM_MODULES)) {
      if (SIDEBAR_SYSTEM_MODULES[key].isCore) {
        nextModules[key] = true;
      } else if (typeof incomingModules[key] === 'boolean') {
        nextModules[key] = incomingModules[key];
      }
    }

    doc.modules = nextModules;
    doc.updatedBy = user?.id || null;
    await doc.save();

    const changes = computeChanges(oldModules, nextModules, Object.keys(SIDEBAR_SYSTEM_MODULES));

    await CacheService.del(MODULE_CONFIG_CACHE_KEY);

    const updatedConfig = await this.getModuleConfig();
    return {
      config: updatedConfig,
      changes,
    };
  }
}

module.exports = new ModuleConfigService();

