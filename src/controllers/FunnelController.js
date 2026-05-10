const FunnelService = require("../services/FunnelService");
const { sendSuccess } = require("../utils/http");
const SystemLogService = require("../services/SystemLogService");
const { RESOURCES } = require("../constants/rbac");

const RESOURCE = RESOURCES.LEADS_CFG;

class FunnelController {
  // ─── Folders ───────────────────────────────────────────────────────────────────

  async getFolders(req, res) {
    const data = await FunnelService.getFolders();
    return sendSuccess(res, 200, "Lấy danh sách thư mục thành công", data);
  }

  async createFolder(req, res) {
    const data = await FunnelService.createFolder(req.body);
    SystemLogService.log({ action: "create", resource: RESOURCE, resourceId: data.id, resourceName: data.name, description: `Tạo thư mục phễu "${data.name}"`, metadata: { newItem: data }, req });
    return sendSuccess(res, 201, "Tạo thư mục thành công", data);
  }

  async updateFolder(req, res) {
    const data = await FunnelService.updateFolder(req.params.id, req.body);
    SystemLogService.log({ action: "update", resource: RESOURCE, resourceId: data.id, resourceName: data.name, description: `Cập nhật thư mục phễu "${data.name}"`, metadata: { updatedItem: data }, req });
    return sendSuccess(res, 200, "Cập nhật thư mục thành công", data);
  }

  async deleteFolder(req, res) {
    const { id } = req.params;
    const data = await FunnelService.deleteFolder(id);
    SystemLogService.log({ action: "delete", resource: RESOURCE, resourceId: id, resourceName: data.name, description: `Xóa thư mục phễu "${data.name}"`, metadata: { deletedItem: data }, req });
    return sendSuccess(res, 200, "Xóa thư mục thành công", { id });
  }

  // ─── Groups ────────────────────────────────────────────────────────────────────

  async getGroups(req, res) {
    const data = await FunnelService.getGroups();
    return sendSuccess(res, 200, "Lấy danh sách nhóm phễu thành công", data);
  }

  async createGroup(req, res) {
    const data = await FunnelService.createGroup(req.body);
    SystemLogService.log({ action: "create", resource: RESOURCE, resourceId: data.id, resourceName: data.name, description: `Tạo nhóm phễu "${data.name}"`, metadata: { newItem: data }, req });
    return sendSuccess(res, 201, "Tạo nhóm phễu thành công", data);
  }

  async updateGroup(req, res) {
    const data = await FunnelService.updateGroup(req.params.id, req.body);
    SystemLogService.log({ action: "update", resource: RESOURCE, resourceId: data.id, resourceName: data.name, description: `Cập nhật nhóm phễu "${data.name}"`, metadata: { updatedItem: data }, req });
    return sendSuccess(res, 200, "Cập nhật nhóm phễu thành công", data);
  }

  async deleteGroup(req, res) {
    const { id } = req.params;
    const data = await FunnelService.deleteGroup(id);
    SystemLogService.log({ action: "delete", resource: RESOURCE, resourceId: id, resourceName: data.name, description: `Xóa nhóm phễu "${data.name}"`, metadata: { deletedItem: data }, req });
    return sendSuccess(res, 200, "Xóa nhóm phễu thành công", { id });
  }

  // ─── Funnels ───────────────────────────────────────────────────────────────────

  async getFunnels(req, res) {
    const data = await FunnelService.getFunnels();
    return sendSuccess(res, 200, "Lấy danh sách phễu thành công", data);
  }

  async createFunnel(req, res) {
    const data = await FunnelService.createFunnel(req.body);
    SystemLogService.log({ action: "create", resource: RESOURCE, resourceId: data.id, resourceName: data.name, description: `Tạo phễu "${data.name}"`, metadata: { newItem: data }, req });
    return sendSuccess(res, 201, "Tạo phễu thành công", data);
  }

  async updateFunnel(req, res) {
    const data = await FunnelService.updateFunnel(req.params.id, req.body);
    SystemLogService.log({ action: "update", resource: RESOURCE, resourceId: data.id, resourceName: data.name, description: `Cập nhật phễu "${data.name}"`, metadata: { updatedItem: data }, req });
    return sendSuccess(res, 200, "Cập nhật phễu thành công", data);
  }

  async deleteFunnel(req, res) {
    const { id } = req.params;
    const data = await FunnelService.deleteFunnel(id);
    SystemLogService.log({ action: "delete", resource: RESOURCE, resourceId: id, resourceName: data.name, description: `Xóa phễu "${data.name}"`, metadata: { deletedItem: data }, req });
    return sendSuccess(res, 200, "Xóa phễu thành công", { id });
  }
}

module.exports = new FunnelController();
