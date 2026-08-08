const CourseLecturerService = require('./courseLecturer.service');
const SystemLogService = require('../../system/log/systemLog.service');
const { sendSuccess } = require('../../../core/utils/http');
const { RESOURCES } = require('../../../core/constants/rbac');

class CourseLecturerController {
  async getLecturers(req, res) {
    const data = await CourseLecturerService.getLecturers(req.query);
    return sendSuccess(res, 200, "Lấy danh sách giảng viên thành công", data);
  }

  async getLecturerById(req, res) {
    const { id } = req.params;
    const data = await CourseLecturerService.getLecturerById(id);
    return sendSuccess(res, 200, "Lấy thông tin giảng viên thành công", data);
  }

  async createLecturer(req, res) {
    const data = await CourseLecturerService.createLecturer(req.body, req.user);

    SystemLogService.log({
      action: "create",
      resource: RESOURCES.COURSES,
      resourceId: data.id,
      resourceName: data.name,
      description: `Tạo giảng viên: "${data.name}"`,
      metadata: { newItem: data },
      req,
    });

    return sendSuccess(res, 201, "Tạo giảng viên thành công", data);
  }

  async updateLecturer(req, res) {
    const { id } = req.params;
    const force = req.query.force === "true";
    console.log(`[updateLecturer] id=${id}, req.query.force=${req.query.force}, parsed_force=${force}`);
    const { lecturer, changes } = await CourseLecturerService.updateLecturer(
      id,
      req.body,
      force
    );

    SystemLogService.log({
      action: "update",
      resource: RESOURCES.COURSES,
      resourceId: lecturer.id,
      resourceName: lecturer.name,
      description: `Cập nhật thông tin giảng viên: "${lecturer.name}"`,
      metadata: { changes },
      req,
    });

    return sendSuccess(res, 200, "Cập nhật giảng viên thành công", lecturer);
  }

  async deleteLecturer(req, res) {
    const { id } = req.params;
    const force = req.query.force === "true";
    console.log(`[deleteLecturer] id=${id}, req.query.force=${req.query.force}, parsed_force=${force}`);

    const lecturer = await CourseLecturerService.deleteLecturer(id, force);

    SystemLogService.log({
      action: force ? "force_delete" : "delete",
      resource: RESOURCES.COURSES,
      resourceId: lecturer.id,
      resourceName: lecturer.name,
      description: `Xóa giảng viên: "${lecturer.name}"`,
      metadata: { deletedItem: lecturer },
      req,
    });

    return sendSuccess(res, 200, "Xóa giảng viên thành công", lecturer);
  }
}

module.exports = new CourseLecturerController();
