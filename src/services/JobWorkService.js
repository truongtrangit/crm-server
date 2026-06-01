const JobFolder = require("../models/JobFolder");
const JobTask = require("../models/JobTask");
const { ID_PREFIXES, generateMonotonicId } = require("../utils/id");

class JobWorkService {
  // ==========================================
  // JOB FOLDER
  // ==========================================
  async getFolders() {
    return JobFolder.find().sort({ order: 1, createdAt: 1 });
  }

  async createFolder(data) {
    const id = await generateMonotonicId(ID_PREFIXES.JOB_FOLDER || "JBF");
    const count = await JobFolder.countDocuments();
    const newFolder = new JobFolder({
      ...data,
      id,
      order: data.order || count + 1
    });
    return newFolder.save();
  }

  async updateFolder(id, data) {
    const folder = await JobFolder.findOneAndUpdate({ id }, data, { new: true });
    if (!folder) throw Object.assign(new Error("Không tìm thấy thư mục"), { status: 404 });
    return folder;
  }

  async deleteFolder(id) {
    const folder = await JobFolder.findOne({ id });
    if (!folder) throw Object.assign(new Error("Không tìm thấy thư mục"), { status: 404 });
    if (folder.isSystem) throw Object.assign(new Error("Không thể xoá thư mục hệ thống"), { status: 400 });
    
    // Check if there are tasks
    const taskCount = await JobTask.countDocuments({ folderId: id });
    if (taskCount > 0) throw Object.assign(new Error("Thư mục đang chứa công việc, không thể xoá"), { status: 400 });

    await JobFolder.deleteOne({ id });
    return true;
  }

  async reorderFolders(orderedIds) {
    if (!orderedIds || orderedIds.length === 0) return true;

    // 1. Kiểm tra tồn tại
    const existingFolders = await JobFolder.find({ id: { $in: orderedIds } });
    if (existingFolders.length !== orderedIds.length) {
      throw Object.assign(new Error("Danh sách ID không hợp lệ hoặc chứa thư mục không tồn tại"), { status: 400 });
    }

    // 2. Kiểm tra cùng cấp (cùng parentId)
    const parentId = existingFolders[0].parentId;
    const allSameParent = existingFolders.every(f => f.parentId === parentId);
    if (!allSameParent) {
      throw Object.assign(new Error("Tất cả các thư mục được sắp xếp phải nằm cùng một cấp"), { status: 400 });
    }

    // 3. Kiểm tra đủ số lượng của cấp đó
    const totalInDb = await JobFolder.countDocuments({ parentId });
    if (totalInDb !== orderedIds.length) {
      throw Object.assign(new Error("Vui lòng gửi đầy đủ danh sách các thư mục trong cùng cấp để sắp xếp"), { status: 400 });
    }

    const promises = orderedIds.map((id, index) => 
      JobFolder.findOneAndUpdate({ id }, { order: index })
    );
    await Promise.all(promises);
    return true;
  }

  // ==========================================
  // JOB TASK
  // ==========================================
  async getTasks(filters) {
    const query = {};
    if (filters.folderId) query.folderId = filters.folderId;
    if (filters.statusId) query.statusId = filters.statusId;
    if (filters.assignee) query.assignees = filters.assignee;
    
    return JobTask.find(query).sort({ scheduledDate: 1, createdAt: -1 });
  }

  async getTaskById(id) {
    const task = await JobTask.findOne({ id });
    if (!task) throw Object.assign(new Error("Không tìm thấy công việc"), { status: 404 });
    return task;
  }

  async createTask(data, currentUser) {
    const id = await generateMonotonicId(ID_PREFIXES.JOB_TASK || "JBT");
    const newTask = new JobTask({
      ...data,
      id,
      createdBy: currentUser ? currentUser.id : null,
      logs: [{
        action: "create",
        description: "Tạo công việc",
        user: currentUser ? { id: currentUser.id, name: currentUser.name, email: currentUser.email } : { id: "SYSTEM", name: "System" }
      }]
    });
    return newTask.save();
  }

  async updateTask(id, data, currentUser) {
    const task = await JobTask.findOne({ id });
    if (!task) throw Object.assign(new Error("Không tìm thấy công việc"), { status: 404 });

    Object.assign(task, data);
    
    task.logs.push({
      action: "update",
      description: "Cập nhật thông tin công việc",
      user: currentUser ? { id: currentUser.id, name: currentUser.name, email: currentUser.email } : { id: "SYSTEM", name: "System" }
    });

    return task.save();
  }

  async updateTaskStatus(id, statusId, currentUser) {
    const task = await JobTask.findOne({ id });
    if (!task) throw Object.assign(new Error("Không tìm thấy công việc"), { status: 404 });

    if (task.statusId !== statusId) {
      task.statusId = statusId;
      task.logs.push({
        action: "update_status",
        description: `Chuyển trạng thái công việc`,
        user: currentUser ? { id: currentUser.id, name: currentUser.name, email: currentUser.email } : { id: "SYSTEM", name: "System" }
      });
      return task.save();
    }
    return task;
  }

  async deleteTask(id) {
    const result = await JobTask.deleteOne({ id });
    if (result.deletedCount === 0) throw Object.assign(new Error("Không tìm thấy công việc"), { status: 404 });
    return true;
  }
}

module.exports = new JobWorkService();
