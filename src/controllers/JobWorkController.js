const JobWorkService = require("../services/JobWorkService");
const { sendSuccess } = require("../utils/http");
const SystemLogService = require("../services/SystemLogService");
const { RESOURCES } = require("../constants/rbac");

class JobWorkController {
  // ==========================================
  // JOB FOLDER
  // ==========================================
  async getFolders(req, res) {
    const folders = await JobWorkService.getFolders(req.user);
    return sendSuccess(res, 200, "Lấy danh sách thư mục thành công", folders);
  }

  async createFolder(req, res) {
    const folder = await JobWorkService.createFolder(req.body, req.user);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.JOBHUB,
      resourceId: folder.id,
      resourceName: folder.name,
      description: `Tạo thư mục JobHub mới: "${folder.name}"`,
      metadata: { newItem: folder },
      req,
    });
    return sendSuccess(res, 201, "Tạo thư mục thành công", folder);
  }

  async updateFolder(req, res) {
    const { folder, changes } = await JobWorkService.updateFolder(req.params.id, req.body);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: folder.name,
      description: `Cập nhật thư mục JobHub: "${folder.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật thư mục thành công", folder);
  }

  async deleteFolder(req, res) {
    const folder = await JobWorkService.deleteFolder(req.params.id);
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: folder ? folder.name : req.params.id,
      description: `Xóa thư mục JobHub: "${folder ? folder.name : req.params.id}"`,
      metadata: { deletedItem: folder },
      req,
    });
    return sendSuccess(res, 200, "Xóa thư mục thành công");
  }

  async reorderFolders(req, res) {
    await JobWorkService.reorderFolders(req.body.orderedIds);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.JOBHUB,
      description: `Sắp xếp lại thứ tự các thư mục JobHub`,
      metadata: { orderedIds: req.body.orderedIds },
      req,
    });
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
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.JOBHUB,
      resourceId: task.id,
      resourceName: task.name,
      description: `Tạo công việc JobHub mới: "${task.name}"`,
      metadata: { newItem: task },
      req,
    });
    return sendSuccess(res, 201, "Tạo công việc thành công", task);
  }

  async updateTask(req, res) {
    const { task, changes } = await JobWorkService.updateTask(
      req.params.id,
      req.body,
      req.user,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: task.name,
      description: `Cập nhật công việc JobHub: "${task.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật công việc thành công", task);
  }

  async updateTaskStatus(req, res) {
    const { statusId } = req.body;
    const { task, changes } = await JobWorkService.updateTaskStatus(
      req.params.id,
      statusId,
      req.user,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: task.name,
      description: `Cập nhật trạng thái công việc JobHub: "${task.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật trạng thái thành công", task);
  }

  async deleteTask(req, res) {
    const task = await JobWorkService.deleteTask(req.params.id);
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: task ? task.name : req.params.id,
      description: `Xóa công việc JobHub: "${task ? task.name : req.params.id}"`,
      metadata: { deletedItem: task },
      req,
    });
    return sendSuccess(res, 200, "Xóa công việc thành công");
  }
}

module.exports = new JobWorkController();
