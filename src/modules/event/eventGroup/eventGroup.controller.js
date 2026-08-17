const { sendSuccess } = require("../../../core/utils/http");
const EventGroupService = require("./eventGroup.service");

class EventGroupController {
  async listGroups(req, res) {
    const groups = await EventGroupService.listGroups(req.query);
    return sendSuccess(res, 200, "Event groups retrieved", { groups });
  }

  async createGroup(req, res) {
    const group = await EventGroupService.createGroup(req.body);
    return sendSuccess(res, 201, "Event group created", { group });
  }

  async updateGroup(req, res) {
    const group = await EventGroupService.updateGroup(req.params.id, req.body);
    return sendSuccess(res, 200, "Event group updated", { group });
  }

  async deleteGroup(req, res) {
    await EventGroupService.deleteGroup(req.params.id);
    return sendSuccess(res, 200, "Event group deleted");
  }
}

module.exports = new EventGroupController();
