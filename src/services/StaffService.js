const Staff = require("../models/Staff");
const {
  resolvePagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { createHttpError } = require("../utils/http");
const { generateMonotonicId, ID_PREFIXES } = require("../utils/id");
const { computeChanges } = require("../utils/diff");

class StaffService {
  /**
   * Lấy danh sách Staff có phân trang
   */
  async getStaffs(query) {
    const { page, limit, skip } = resolvePagination(query || {});
    const filter = {};

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: "i" } },
        { id: { $regex: query.search, $options: "i" } },
      ];
    }
    if (query.functionalGroupId) {
      filter.functionalGroupId = query.functionalGroupId;
    }
    if (query.company) {
      filter.companies = query.company;
    }
    if (query.status) {
      filter.status = query.status;
    }

    const [items, total] = await Promise.all([
      Staff.find(filter)
        .populate("functionalGroupId", "name id")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Staff.countDocuments(filter),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  /**
   * Lấy Staff theo ID
   */
  async getStaffById(id) {
    const staff = await Staff.findOne({ id })
      .populate("functionalGroupId", "name id")
      .lean();
    if (!staff) {
      throw createHttpError(404, "Không tìm thấy nhân sự");
    }
    return staff;
  }

  /**
   * Tạo Staff mới
   */
  async createStaff(data) {
    const id = await generateMonotonicId(ID_PREFIXES.STAFF);
    const staff = new Staff({ ...data, id });
    await staff.save();
    return staff;
  }

  /**
   * Cập nhật Staff
   */
  async updateStaff(id, data) {
    const staff = await Staff.findOne({ id });
    if (!staff) {
      throw createHttpError(404, "Không tìm thấy nhân sự");
    }

    // Nếu chuyển trạng thái từ Đã nghỉ việc -> Đang làm việc thì xóa ngày nghỉ việc
    if (data.status === "Đang làm việc" && staff.status === "Đã nghỉ việc") {
      staff.resignationDate = undefined;
    }

    const oldState = staff.toObject();
    Object.assign(staff, data);
    await staff.save();
    const newState = staff.toObject();
    const changes = computeChanges(oldState, newState);
    return { staff, changes };
  }

  /**
   * Xóa mềm Staff
   */
  async deleteStaff(id) {
    const staff = await Staff.findOne({ id });
    if (!staff) {
      throw createHttpError(404, "Không tìm thấy nhân sự");
    }

    if (typeof staff.delete === "function") {
      await staff.delete(); // softDeletePlugin
    } else {
      staff.isDeleted = true;
      await staff.save();
    }
    return staff;
  }

  /**
   * Thêm cấu hình lương
   */
  async addSalaryConfig(id, configData) {
    const staff = await Staff.findOne({ id });
    if (!staff) {
      throw createHttpError(404, "Không tìm thấy nhân sự");
    }

    const oldState = staff.toObject();
    staff.salaryConfigs.push(configData);
    await staff.save();
    const newState = staff.toObject();
    const changes = computeChanges(oldState, newState);
    return { staff, changes };
  }
}

module.exports = new StaffService();
