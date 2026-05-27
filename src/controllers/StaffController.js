const StaffService = require("../services/StaffService");
const SystemLogService = require("../services/SystemLogService");
const { RESOURCES } = require("../constants/rbac");
const { sendSuccess } = require("../utils/http");

class StaffController {
  async getStaffs(req, res) {
    const result = await StaffService.getStaffs(req.query);
    return sendSuccess(res, 200, "Get staff list success", result);
  }

  async getStaff(req, res) {
    const staff = await StaffService.getStaffById(req.params.staffId);
    return sendSuccess(res, 200, "Get staff detail success", staff);
  }

  async createStaff(req, res) {
    const body = {
      ...req.body,
      createdBy: req.user.id
    };
    
    const staff = await StaffService.createStaff(body);

    SystemLogService.log({ action: "create", resource: RESOURCES.STAFFS, resourceId: staff.id, resourceName: staff.name, description: `Tạo nhân sự: ${staff.name}`, metadata: { newItem: staff }, req });

    return sendSuccess(res, 201, "Create staff success", staff);
  }

  async updateStaff(req, res) {
    const staff = await StaffService.updateStaff(req.params.staffId, req.body);

    SystemLogService.log({ action: "update", resource: RESOURCES.STAFFS, resourceId: staff.id, resourceName: staff.name, description: `Cập nhật nhân sự: ${staff.name}`, metadata: { changes: req.body }, req });

    return sendSuccess(res, 200, "Update staff success", staff);
  }

  async deleteStaff(req, res) {
    const staff = await StaffService.getStaffById(req.params.staffId);
    await StaffService.deleteStaff(req.params.staffId);

    SystemLogService.log({ action: "delete", resource: RESOURCES.STAFFS, resourceId: staff.id, resourceName: staff.name, description: `Xoá nhân sự: ${staff.name}`, metadata: { deletedItem: staff }, req });

    return sendSuccess(res, 200, "Delete staff success", null);
  }

  async addSalaryConfig(req, res) {
    const body = {
      ...req.body,
      createdBy: req.user.id
    };
    
    const staff = await StaffService.addSalaryConfig(req.params.staffId, body);

    SystemLogService.log({ action: "update", resource: RESOURCES.STAFFS, resourceId: staff.id, resourceName: staff.name, description: `Thêm cấu hình lương mới cho nhân sự: ${staff.name}`, metadata: { changes: body }, req });

    return sendSuccess(res, 201, "Add salary config success", staff);
  }
}

module.exports = new StaffController();
