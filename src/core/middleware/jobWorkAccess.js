const JobFolder = require('../../modules/job/jobWork/jobFolder.model');
const JobTask = require('../../modules/job/jobWork/jobTask.model');
const { requireResourceAccess, requireBulkResourceAccess } = require('./resourceAccess');

const jobFolderAccess = requireResourceAccess({
  getResource: async (req) => {
    return JobFolder.findOne({ id: req.params.id }).lean();
  },
  getCreatorId: (folder) => folder.createdBy,
  getAssigneeIds: (folder) => folder.assignees || [],
  allowCreator: true,
  allowManagerSubordinateCreator: true,
  allowAssignee: false, // Default is false for delete. We'll override with .with({ allowAssignee: true }) for update.
});

const jobFolderBulkAccess = requireBulkResourceAccess({
  getResources: async (req) => {
    const orderedIds = req.body.orderedIds || [];
    if (orderedIds.length === 0) return [];
    return JobFolder.find({ id: { $in: orderedIds } }).lean();
  },
  getCreatorId: (folder) => folder.createdBy,
  allowCreator: true,
  allowManagerSubordinateCreator: true,
  allowAssignee: false,
  errorMessage: "Bạn không có quyền sắp xếp một số thư mục trong danh sách",
});

const jobTaskAccess = requireResourceAccess({
  getResource: async (req) => {
    const task = await JobTask.findOne({ id: req.params.id }).lean();
    if (task && task.folderId) {
      const folder = await JobFolder.findOne({ id: task.folderId }).lean();
      task._folderAssignees = folder?.assignees || [];
    }
    return task;
  },
  getCreatorId: (task) => task.createdBy,
  getAssigneeIds: (task) => [...(task.assignees || []), ...(task._folderAssignees || [])],
  allowCreator: true,
  allowManagerSubordinateCreator: true,
  allowAssignee: false, 
});

module.exports = {
  jobFolderAccess,
  jobFolderBulkAccess,
  jobTaskAccess,
};
