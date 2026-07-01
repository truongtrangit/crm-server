const projectBonusService = require('./projectBonus.service');
const {
  createProjectBonusSchema,
  updateProjectBonusSchema,
} = require('./projectBonus.validation');
const { sendSuccess, createHttpError } = require('../../../core/utils/http');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');

class ProjectBonusController {
  async getAllProjectBonuses(req, res) {
    const bonuses = await projectBonusService.getAllProjectBonuses();
    return sendSuccess(res, 200, "Lấy danh sách thưởng dự án thành công", bonuses);
  }

  async getProjectBonusById(req, res) {
    const bonus = await projectBonusService.getProjectBonusById(req.params.id);
    if (!bonus) {
      throw createHttpError(404, 'Không tìm thấy loại thưởng dự án này');
    }
    return sendSuccess(res, 200, "Lấy thông tin thưởng dự án thành công", bonus);
  }

  async createProjectBonus(req, res) {
    const { error, value } = createProjectBonusSchema.validate(req.body);
    if (error) {
      throw createHttpError(400, error.details[0].message);
    }

    const payload = {
      ...value,
      createdBy: req.user.id,
    };

    const bonus = await projectBonusService.createProjectBonus(payload);
    
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.PROJECT_BONUS,
      resourceId: bonus._id.toString(),
      resourceName: bonus.name,
      description: `Tạo mới loại thưởng dự án: "${bonus.name}"`,
      metadata: { newItem: bonus },
      req,
    });

    return sendSuccess(res, 201, "Tạo loại thưởng dự án thành công", bonus);
  }

  async updateProjectBonus(req, res) {
    const { error, value } = updateProjectBonusSchema.validate(req.body);
    if (error) {
      throw createHttpError(400, error.details[0].message);
    }

    const bonus = await projectBonusService.updateProjectBonus(
      req.params.id,
      value,
    );
    if (!bonus) {
      throw createHttpError(404, 'Không tìm thấy loại thưởng dự án này');
    }

    SystemLogService.log({
      action: "update",
      resource: RESOURCES.PROJECT_BONUS,
      resourceId: bonus._id.toString(),
      resourceName: bonus.name,
      description: `Cập nhật loại thưởng dự án: "${bonus.name}"`,
      metadata: { changes: value },
      req,
    });

    return sendSuccess(res, 200, "Cập nhật loại thưởng dự án thành công", bonus);
  }

  async deleteProjectBonus(req, res) {
    const bonus = await projectBonusService.deleteProjectBonus(req.params.id);
    if (!bonus) {
      throw createHttpError(404, 'Không tìm thấy loại thưởng dự án này');
    }

    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.PROJECT_BONUS,
      resourceId: bonus._id.toString(),
      resourceName: bonus.name,
      description: `Xoá loại thưởng dự án: "${bonus.name}"`,
      metadata: { deletedItem: bonus },
      req,
    });

    return sendSuccess(res, 200, "Xóa loại thưởng dự án thành công");
  }
}

module.exports = new ProjectBonusController();
