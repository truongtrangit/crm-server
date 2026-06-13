const { sendSuccess, sendError } = require('../../../core/utils/http');
const companyService = require('./company.service');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');

class CompanyController {
  async getCompanies(req, res) {
    const companies = await companyService.getCompanies();
    sendSuccess(res, 200, "Lấy danh sách công ty thành công", { items: companies });
  }

  async getCompanyById(req, res) {
    const company = await companyService.getCompanyById(req.params.id);
    sendSuccess(res, 200, "Lấy công ty thành công", company);
  }

  async createCompany(req, res) {
    const company = await companyService.createCompany(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.COMPANIES,
      resourceId: company.id,
      resourceName: company.name,
      description: `Tạo công ty mới: "${company.name}"`,
      metadata: { newItem: company },
      req,
    });
    sendSuccess(res, 201, "Tạo công ty thành công", company);
  }

  async updateCompany(req, res) {
    const { company, changes } = await companyService.updateCompany(req.params.id, req.body);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.COMPANIES,
      resourceId: req.params.id,
      resourceName: company.name,
      description: `Cập nhật công ty: "${company.name}"`,
      metadata: { changes },
      req,
    });
    sendSuccess(res, 200, "Cập nhật công ty thành công", company);
  }

  async deleteCompany(req, res) {
    const force = req.query.force === "true";
    const company = await companyService.deleteCompany(req.params.id, force);
    SystemLogService.log({
      action: force ? "force_delete" : "delete",
      resource: RESOURCES.COMPANIES,
      resourceId: req.params.id,
      resourceName: company ? company.name : req.params.id,
      description: `${force ? "Xóa vĩnh viễn" : "Xóa"} công ty: "${company ? company.name : req.params.id}"`,
      metadata: { deletedItem: company },
      req,
    });
    sendSuccess(res, 200, "Xóa công ty thành công");
  }
}

module.exports = new CompanyController();
