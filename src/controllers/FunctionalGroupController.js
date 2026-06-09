const FunctionalGroupService = require("../services/FunctionalGroupService");
const { sendSuccess } = require("../utils/http");
const SystemLogService = require("../services/SystemLogService");
const { RESOURCES } = require("../constants/rbac");

class FunctionalGroupController {
  getGroups = async (req, res) => {
    const data = await FunctionalGroupService.getGroups(req.query);
    return sendSuccess(res, 200, "Get functional groups success", data);
  };

  createGroup = async (req, res) => {
    const item = await FunctionalGroupService.createGroup(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.FUNCTIONAL_GROUPS,
      resourceId: item.id,
      resourceName: item.name,
      description: `Tạo khối chức năng "${item.name}"`,
      metadata: { newItem: item },
      req,
    });
    return sendSuccess(res, 201, "Create functional group success", item);
  };

  updateGroup = async (req, res) => {
    const { item, changes } = await FunctionalGroupService.updateGroup(req.params.id, req.body);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.FUNCTIONAL_GROUPS,
      resourceId: item.id,
      resourceName: item.name,
      description: `Cập nhật khối chức năng "${item.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Update functional group success", item);
  };

  deleteGroup = async (req, res) => {
    const item = await FunctionalGroupService.deleteGroup(req.params.id);
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.FUNCTIONAL_GROUPS,
      resourceId: item.id,
      resourceName: item.name,
      description: `Xóa khối chức năng "${item.name}"`,
      metadata: { deletedItem: item },
      req,
    });
    return sendSuccess(res, 200, "Delete functional group success", null);
  };
}

module.exports = new FunctionalGroupController();
