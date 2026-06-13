const MetadataService = require('./metadata.service');
const { paginateArray } = require('../../../core/utils/pagination');
const { sendSuccess } = require('../../../core/utils/http');

class MetadataController {
  getMetadata = async (req, res) => {
    const metadata = await MetadataService.getDerivedMetadata();
    return sendSuccess(res, 200, "Get metadata success", metadata);
  };

  getRoles = async (req, res) => {
    const metadata = await MetadataService.getDerivedMetadata();
    return sendSuccess(res, 200, "Get roles success", paginateArray(metadata.userRoles, req.query || {}));
  };

  getDepartments = async (req, res) => {
    const metadata = await MetadataService.getDerivedMetadata();
    return sendSuccess(res, 200, "Get departments success", paginateArray(metadata.departments, req.query || {}));
  };

  getDepartmentGroups = async (req, res) => {
    const metadata = await MetadataService.getDerivedMetadata();
    return sendSuccess(res, 200, "Get department groups success", metadata.departmentGroups);
  };

  getActivityGroups = async (req, res) => {
    const metadata = await MetadataService.getDerivedMetadata();
    return sendSuccess(res, 200, "Get activity groups success", paginateArray(metadata.activityGroups, req.query || {}));
  };

  getCustomerGroups = async (req, res) => {
    const metadata = await MetadataService.getDerivedMetadata();
    return sendSuccess(res, 200, "Get customer groups success", paginateArray(metadata.customerGroups, req.query || {}));
  };
}

module.exports = new MetadataController();
