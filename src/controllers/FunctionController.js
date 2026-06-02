const FunctionService = require("../services/FunctionService");
const { sendSuccess } = require("../utils/http");
const SystemLogService = require("../services/SystemLogService");
const { RESOURCES } = require("../constants/rbac");

class FunctionController {
  getFunctions = async (req, res) => {
    const data = await FunctionService.getFunctions(req.query);
    return sendSuccess(res, 200, "Get functions success", data);
  }

  createFunction = async (req, res) => {
    const item = await FunctionService.createFunction(req.body);
    SystemLogService.log({ action: "create", resource: RESOURCES.FUNCTIONS, resourceId: item.id, resourceName: item.title, description: `Tạo chức năng "${item.title}"`, metadata: { newItem: item }, req });
    return sendSuccess(res, 201, "Create function success", item);
  }

  updateFunction = async (req, res) => {
    const { id } = req.params;
    const item = await FunctionService.updateFunction(id, req.body);
    SystemLogService.log({ action: "update", resource: RESOURCES.FUNCTIONS, resourceId: item.id, resourceName: item.title, description: `Cập nhật chức năng "${item.title}"`, metadata: { updatedItem: item }, req });
    return sendSuccess(res, 200, "Update function success", item);
  }

  deleteFunction = async (req, res) => {
    const { id } = req.params;
    await FunctionService.deleteFunction(id);
    SystemLogService.log({ action: "delete", resource: RESOURCES.FUNCTIONS, resourceId: id, description: `Xóa chức năng "${id}"`, req });
    return sendSuccess(res, 200, "Delete function success");
  }
}

module.exports = new FunctionController();
