const FunctionService = require('./function.service');
const { sendSuccess } = require('../../../core/utils/http');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');

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
    const { item, changes } = await FunctionService.updateFunction(id, req.body);
    SystemLogService.log({ action: "update", resource: RESOURCES.FUNCTIONS, resourceId: item.id, resourceName: item.title, description: `Cập nhật chức năng "${item.title}"`, metadata: { changes }, req });
    return sendSuccess(res, 200, "Update function success", item);
  }

  deleteFunction = async (req, res) => {
    const { id } = req.params;
    const item = await FunctionService.deleteFunction(id);
    SystemLogService.log({ action: "delete", resource: RESOURCES.FUNCTIONS, resourceId: id, resourceName: item?.title, description: `Xóa chức năng "${item?.title || id}"`, metadata: { deletedItem: item }, req });
    return sendSuccess(res, 200, "Delete function success");
  }
}

module.exports = new FunctionController();
