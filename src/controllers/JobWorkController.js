const JobWorkService = require("../services/JobWorkService");
const { sendSuccess } = require("../utils/http");

class JobWorkController {
  // ==========================================
  // JOB FOLDER
  // ==========================================
  async getFolders(req, res) {
    const folders = await JobWorkService.getFolders(req.user);
    return sendSuccess(res, 200, "Lấy danh sách thư mục thành công", folders);
  }

  async createFolder(req, res) {
    const folder = await JobWorkService.createFolder(req.body);
    return sendSuccess(res, 201, "Tạo thư mục thành công", folder);
  }

  async updateFolder(req, res) {
    const folder = await JobWorkService.updateFolder(req.params.id, req.body);
    return sendSuccess(res, 200, "Cập nhật thư mục thành công", folder);
  }

  async deleteFolder(req, res) {
    await JobWorkService.deleteFolder(req.params.id);
    return sendSuccess(res, 200, "Xóa thư mục thành công");
  }

  async reorderFolders(req, res) {
    await JobWorkService.reorderFolders(req.body.orderedIds);
    return sendSuccess(res, 200, "Cập nhật thứ tự thành công");
  }

  // ==========================================
  // JOB TASK
  // ==========================================
  async getTasks(req, res) {
    const tasks = await JobWorkService.getTasks(req.query, req.user);
    return sendSuccess(res, 200, "Lấy danh sách công việc thành công", tasks);
  }

  async getTaskById(req, res) {
    const task = await JobWorkService.getTaskById(req.params.id, req.user);
    return sendSuccess(res, 200, "Lấy chi tiết công việc thành công", task);
  }

  async createTask(req, res) {
    const task = await JobWorkService.createTask(req.body, req.user);
    return sendSuccess(res, 201, "Tạo công việc thành công", task);
  }

  async updateTask(req, res) {
    const task = await JobWorkService.updateTask(req.params.id, req.body, req.user);
    return sendSuccess(res, 200, "Cập nhật công việc thành công", task);
  }

  async updateTaskStatus(req, res) {
    const { statusId } = req.body;
    const task = await JobWorkService.updateTaskStatus(req.params.id, statusId, req.user);
    return sendSuccess(res, 200, "Cập nhật trạng thái thành công", task);
  }

  async deleteTask(req, res) {
    await JobWorkService.deleteTask(req.params.id);
    return sendSuccess(res, 200, "Xóa công việc thành công");
  }
}

module.exports = new JobWorkController();
