const JobFolder = require('./jobFolder.model');
const JobTask = require('./jobTask.model');
const { computeChanges } = require('../../../core/utils/diff');
const { ID_PREFIXES, generateMonotonicId } = require('../../../core/utils/id');
const { isOwnerOrAdmin } = require('../../../core/utils/userRoles');
const {
  getManagerSubordinateIds,
  isUserManagerial,
} = require('../../../core/utils/managerScope');
const User = require('../../system/user/user.model');

class JobWorkService {
  async _validateUserIds(userIds) {
    if (!userIds || userIds.length === 0) return;
    const count = await User.countDocuments({
      id: { $in: userIds },
      isDeleted: { $ne: true },
    });
    if (count !== userIds.length) {
      throw Object.assign(
        new Error(
          "Danh sách người dùng không hợp lệ hoặc chứa user không tồn tại",
        ),
        { status: 400 },
      );
    }
  }
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

  async createFolder(data, currentUser) {
    const id = await generateMonotonicId(ID_PREFIXES.JOB_FOLDER || "JBF");
    const maxFolder = await JobFolder.findOne({
      parentId: data.parentId || null,
    })
      .sort({ order: -1 })
      .lean();
    const nextOrder =
      maxFolder && maxFolder.order !== undefined ? maxFolder.order + 1 : 1;

    const assignees = data.assignees || [];
    if (
      currentUser &&
      !isOwnerOrAdmin(currentUser) &&
      !assignees.includes(currentUser.id)
    ) {
      assignees.push(currentUser.id);
    }

    if (assignees && assignees.length > 0) {
      await this._validateUserIds(assignees);
    }

    const newFolder = new JobFolder({
      ...data,
      assignees,
      id,
      createdBy: currentUser ? currentUser.id : null,
      order: data.order !== undefined ? data.order : nextOrder,
    });
    return newFolder.save();
  }

  async updateFolder(id, data) {
    const folder = await JobFolder.findOne({ id });
    if (!folder)
      throw Object.assign(new Error("Không tìm thấy thư mục"), { status: 404 });

    if (data.assignees) {
      await this._validateUserIds(data.assignees);
    }

    const oldState = folder.toObject();
    Object.assign(folder, data);
    await folder.save();
    const newState = folder.toObject();
    const changes = computeChanges(oldState, newState);

    return { folder, changes };
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

    return folder;
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
        $or: [
          { folderId: { $in: assignedFolderIds } },
          { assignees: user.id },
          { createdBy: user.id },
          { linkAccessUsers: user.id },
        ],
      };

      const isManager = await isUserManagerial(user);
      if (isManager) {
        const subIds = await getManagerSubordinateIds(user);
        if (subIds && subIds.length > 0) {
          permissionQuery.$or.push({ assignees: { $in: subIds } });
          permissionQuery.$or.push({ createdBy: { $in: subIds } });
        }
      }

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
    if (!isOwnerOrAdminUser && user && !task.allowDirectLinkAccess) {
      if (task.createdBy === user.id) return task; // Cho phép người tạo

      const isExplicitViewer =
        task.linkAccessUsers && task.linkAccessUsers.includes(user.id);
      if (isExplicitViewer) return task;

      const isAssignedToTask =
        task.assignees && task.assignees.includes(user.id);
      if (isAssignedToTask) return task;

      // Manager check
      const isManager = await isUserManagerial(user);
      if (isManager) {
        const subIds = await getManagerSubordinateIds(user);
        if (subIds && subIds.length > 0) {
          if (task.createdBy && subIds.includes(task.createdBy)) return task;
          if (
            task.assignees &&
            task.assignees.some((id) => subIds.includes(id))
          )
            return task;
        }
      }

      // Cuối cùng, nếu không pass các quyền ở trên, kiểm tra quyền ở thư mục cha
      if (task.folderId) {
        const folder = await JobFolder.findOne({ id: task.folderId }).lean();
        const isAssignedToFolder =
          folder && folder.assignees && folder.assignees.includes(user.id);
        if (!isAssignedToFolder) {
          throw Object.assign(
            new Error("Bạn không có quyền xem công việc này"),
            { status: 403 },
          );
        }
      } else {
        throw Object.assign(new Error("Bạn không có quyền xem công việc này"), {
          status: 403,
        });
      }
    }

    return task;
  }

  async createTask(data, currentUser) {
    if (data.assignees) await this._validateUserIds(data.assignees);
    if (data.linkAccessUsers) await this._validateUserIds(data.linkAccessUsers);

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

    if (data.assignees) await this._validateUserIds(data.assignees);
    if (data.linkAccessUsers) await this._validateUserIds(data.linkAccessUsers);

    const oldState = task.toObject();
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

    await task.save();
    const newState = task.toObject();
    const changes = computeChanges(oldState, newState);

    return { task, changes };
  }

  async updateTaskStatus(id, statusId, currentUser) {
    const task = await JobTask.findOne({ id });
    if (!task)
      throw Object.assign(new Error("Không tìm thấy công việc"), {
        status: 404,
      });

    if (task.statusId !== statusId) {
      const oldState = task.toObject();
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
      await task.save();
      const newState = task.toObject();
      const changes = computeChanges(oldState, newState);
      return { task, changes };
    }
    return { task, changes: {} };
  }

  async deleteTask(id) {
    const task = await JobTask.findOne({ id });
    if (!task)
      throw Object.assign(new Error("Không tìm thấy công việc"), {
        status: 404,
      });

    await JobTask.deleteOne({ id });
    return task;
  }
}

module.exports = new JobWorkService();
