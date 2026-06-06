const JobFolder = require("../models/JobFolder");
const JobTask = require("../models/JobTask");
const { ID_PREFIXES, generateMonotonicId } = require("../utils/id");
const { isOwnerOrAdmin } = require("../utils/userRoles");

class JobWorkService {
  // ==========================================
  // JOB FOLDER
  // ==========================================
  async getFolders(user) {
    if (!user) return [];

    const isOwnerOrAdminUser = isOwnerOrAdmin(user);
    if (isOwnerOrAdminUser) {
      return JobFolder.find().sort({ order: 1, createdAt: 1 });
    }

    // Find all folders where user is assigned
    const assignedFolders = await JobFolder.find({ assignees: user.id }).lean();
    const assignedFolderIds = assignedFolders.map((f) => f.id);

    // Find all tasks where user is assigned
    const assignedTasks = await JobTask.find({ assignees: user.id })
      .select("folderId")
      .lean();
    const taskFolderIds = assignedTasks
      .map((t) => t.folderId)
      .filter((id) => id);

    // Combine IDs
    const allFolderIds = [...new Set([...assignedFolderIds, ...taskFolderIds])];

    return JobFolder.find({ id: { $in: allFolderIds } }).sort({
      order: 1,
      createdAt: 1,
    });
  }

  async createFolder(data) {
    const id = await generateMonotonicId(ID_PREFIXES.JOB_FOLDER || "JBF");
    const maxFolder = await JobFolder.findOne({
      parentId: data.parentId || null,
    })
      .sort({ order: -1 })
      .lean();
    const nextOrder =
      maxFolder && maxFolder.order !== undefined ? maxFolder.order + 1 : 1;

    const newFolder = new JobFolder({
      ...data,
      id,
      order: data.order !== undefined ? data.order : nextOrder,
    });
    return newFolder.save();
  }

  async updateFolder(id, data) {
    const folder = await JobFolder.findOneAndUpdate({ id }, data, {
      new: true,
    });
    if (!folder)
      throw Object.assign(new Error("Không tìm thấy thư mục"), { status: 404 });
    return folder;
  }

  async deleteFolder(id) {
    const folder = await JobFolder.findOne({ id });
    if (!folder)
      throw Object.assign(new Error("Không tìm thấy thư mục"), { status: 404 });
    if (folder.isSystem)
      throw Object.assign(new Error("Không thể xoá thư mục hệ thống"), {
        status: 400,
      });

    const allFolders = await JobFolder.find().lean();

    const getDescendants = (parentId) => {
      const children = allFolders
        .filter((f) => f.parentId === parentId)
        .map((f) => f.id);
      let allDescendants = [...children];
      for (const childId of children) {
        allDescendants = [...allDescendants, ...getDescendants(childId)];
      }
      return allDescendants;
    };

    const idsToDelete = [id, ...getDescendants(id)];

    // Cập nhật công việc: đưa ra khỏi thư mục
    await JobTask.updateMany(
      { folderId: { $in: idsToDelete } },
      { $set: { folderId: null } },
    );

    // Xoá tất cả các thư mục con và chính nó
    await JobFolder.deleteMany({ id: { $in: idsToDelete } });

    return true;
  }

  async reorderFolders(orderedIds) {
    if (!orderedIds || orderedIds.length === 0) return true;

    // 1. Kiểm tra tồn tại
    const existingFolders = await JobFolder.find({ id: { $in: orderedIds } });
    if (existingFolders.length !== orderedIds.length) {
      throw Object.assign(
        new Error("Danh sách ID không hợp lệ hoặc chứa thư mục không tồn tại"),
        { status: 400 },
      );
    }

    // 2. Kiểm tra cùng cấp (cùng parentId)
    const parentId = existingFolders[0].parentId;
    const allSameParent = existingFolders.every((f) => f.parentId === parentId);
    if (!allSameParent) {
      throw Object.assign(
        new Error("Tất cả các thư mục được sắp xếp phải nằm cùng một cấp"),
        { status: 400 },
      );
    }

    // 3. Kiểm tra đủ số lượng của cấp đó
    const totalInDb = await JobFolder.countDocuments({ parentId });
    if (totalInDb !== orderedIds.length) {
      throw Object.assign(
        new Error(
          "Vui lòng gửi đầy đủ danh sách các thư mục trong cùng cấp để sắp xếp",
        ),
        { status: 400 },
      );
    }

    const promises = orderedIds.map((id, index) =>
      JobFolder.findOneAndUpdate({ id }, { order: index + 1 }),
    );
    await Promise.all(promises);
    return true;
  }

  // ==========================================
  // JOB TASK
  // ==========================================
  async getTasks(filters, user) {
    let query = {};
    if (filters.folderId) query.folderId = filters.folderId;
    if (filters.statusId) query.statusId = filters.statusId;
    if (filters.assignee) query.assignees = filters.assignee;

    const isOwnerOrAdminUser = isOwnerOrAdmin(user);

    if (!isOwnerOrAdminUser && user) {
      const assignedFolders = await JobFolder.find({ assignees: user.id })
        .select("id")
        .lean();
      const assignedFolderIds = assignedFolders.map((f) => f.id);

      const permissionQuery = {
        $or: [{ folderId: { $in: assignedFolderIds } }, { assignees: user.id }],
      };

      if (Object.keys(query).length > 0) {
        query = { $and: [query, permissionQuery] };
      } else {
        query = permissionQuery;
      }
    }

    return JobTask.find(query).sort({ scheduledDate: 1, createdAt: -1 });
  }

  async getTaskById(id, user) {
    const task = await JobTask.findOne({ id }).lean();
    if (!task)
      throw Object.assign(new Error("Không tìm thấy công việc"), {
        status: 404,
      });

    const isOwnerOrAdminUser = isOwnerOrAdmin(user);
    if (!isOwnerOrAdminUser && user) {
      const isAssignedToTask =
        task.assignees && task.assignees.includes(user.id);
      if (!isAssignedToTask && task.folderId) {
        const folder = await JobFolder.findOne({ id: task.folderId }).lean();
        const isAssignedToFolder =
          folder && folder.assignees && folder.assignees.includes(user.id);
        if (!isAssignedToFolder) {
          throw Object.assign(
            new Error("Bạn không có quyền xem công việc này"),
            { status: 403 },
          );
        }
      }
    }

    return task;
  }

  async createTask(data, currentUser) {
    const id = await generateMonotonicId(ID_PREFIXES.JOB_TASK || "JBT");
    const newTask = new JobTask({
      ...data,
      id,
      createdBy: currentUser ? currentUser.id : null,
      logs: [
        {
          action: "create",
          description: "Tạo công việc",
          user: currentUser
            ? {
                id: currentUser.id,
                name: currentUser.name,
                email: currentUser.email,
              }
            : { id: "SYSTEM", name: "System" },
        },
      ],
    });
    return newTask.save();
  }

  async updateTask(id, data, currentUser) {
    const task = await JobTask.findOne({ id });
    if (!task)
      throw Object.assign(new Error("Không tìm thấy công việc"), {
        status: 404,
      });

    Object.assign(task, data);

    task.logs.push({
      action: "update",
      description: "Cập nhật thông tin công việc",
      user: currentUser
        ? {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
          }
        : { id: "SYSTEM", name: "System" },
    });

    return task.save();
  }

  async updateTaskStatus(id, statusId, currentUser) {
    const task = await JobTask.findOne({ id });
    if (!task)
      throw Object.assign(new Error("Không tìm thấy công việc"), {
        status: 404,
      });

    if (task.statusId !== statusId) {
      task.statusId = statusId;
      task.logs.push({
        action: "update_status",
        description: `Chuyển trạng thái công việc`,
        user: currentUser
          ? {
              id: currentUser.id,
              name: currentUser.name,
              email: currentUser.email,
            }
          : { id: "SYSTEM", name: "System" },
      });
      return task.save();
    }
    return task;
  }

  async deleteTask(id) {
    const result = await JobTask.deleteOne({ id });
    if (result.deletedCount === 0)
      throw Object.assign(new Error("Không tìm thấy công việc"), {
        status: 404,
      });
    return true;
  }
}

module.exports = new JobWorkService();
