const StaffService = require("../services/StaffService");
const SystemLogService = require("../services/SystemLogService");
const { RESOURCES } = require("../constants/rbac");
const { sendSuccess } = require("../utils/http");
const { formatChangesText } = require("../utils/diff");

const STAFF_FIELD_LABELS = {
  name: "Tên",
  phone: "Số điện thoại",
  email: "Email",
  gender: "Giới tính",
  onboardDate: "Ngày vào làm",
  resignationDate: "Ngày nghỉ việc",
  status: "Trạng thái",
  functionalGroupId: "Khối chức năng",
  companies: "Công ty",
  bankName: "Ngân hàng",
  bankAccount: "Số tài khoản",
  bankBranch: "Chi nhánh",
  citizenId: "CCCD",
  citizenIdDate: "Ngày cấp CCCD",
  citizenIdPlace: "Nơi cấp CCCD",
  taxCode: "Mã số thuế",
  socialInsuranceCode: "Mã số BHXH",
  salaryConfigs: "Cấu hình lương",
};

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
      createdBy: req.user.id,
    };

    const staff = await StaffService.createStaff(body);

    SystemLogService.log({
      action: "create",
      resource: RESOURCES.STAFFS,
      resourceId: staff.id,
      resourceName: staff.name,
      description: `Tạo nhân sự: ${staff.name}`,
      metadata: { newItem: staff },
      req,
    });

    return sendSuccess(res, 201, "Create staff success", staff);
  }

  async updateStaff(req, res) {
    const { staff, changes } = await StaffService.updateStaff(
      req.params.staffId,
      req.body,
    );
    const changesText = formatChangesText(changes, STAFF_FIELD_LABELS);

    SystemLogService.log({
      action: "update",
      resource: RESOURCES.STAFFS,
      resourceId: staff.id,
      resourceName: staff.name,
      description: `Cập nhật nhân sự: ${staff.name}${changesText}`,
      metadata: { changes },
      req,
    });

    return sendSuccess(res, 200, "Update staff success", staff);
  }

  async deleteStaff(req, res) {
    const staff = await StaffService.getStaffById(req.params.staffId);
    await StaffService.deleteStaff(req.params.staffId);

    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.STAFFS,
      resourceId: staff.id,
      resourceName: staff.name,
      description: `Xoá nhân sự: ${staff.name}`,
      metadata: { deletedItem: staff },
      req,
    });

    return sendSuccess(res, 200, "Delete staff success", null);
  }

  async addSalaryConfig(req, res) {
    const { staffId, ...rest } = req.body;
    const body = {
      ...rest,
      createdBy: req.user.id,
    };

    const { staff, changes } = await StaffService.addSalaryConfig(
      staffId,
      body,
    );

    SystemLogService.log({
      action: "update",
      resource: RESOURCES.STAFFS,
      resourceId: staff.id,
      resourceName: staff.name,
      description: `Thêm cấu hình lương mới cho nhân sự: ${staff.name}`,
      metadata: { changes },
      req,
    });

    return sendSuccess(res, 201, "Add salary config success", staff);
  }
}

module.exports = new StaffController();
