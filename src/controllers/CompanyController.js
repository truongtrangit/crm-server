const { sendSuccess, sendError } = require("../utils/http");
const companyService = require("../services/CompanyService");

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
    sendSuccess(res, 201, "Tạo công ty thành công", company);
  }

  async updateCompany(req, res) {
    const company = await companyService.updateCompany(req.params.id, req.body);
    sendSuccess(res, 200, "Cập nhật công ty thành công", company);
  }

  async deleteCompany(req, res) {
    const force = req.query.force === "true";
    await companyService.deleteCompany(req.params.id, force);
    sendSuccess(res, 200, "Xóa công ty thành công");
  }
}

module.exports = new CompanyController();
