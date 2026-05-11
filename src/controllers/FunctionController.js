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
}

module.exports = new FunctionController();
