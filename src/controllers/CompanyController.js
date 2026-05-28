const { sendSuccess, sendError } = require("../utils/http");
const companyService = require("../services/CompanyService");

class CompanyController {
  async getCompanies(req, res, next) {
    try {
      const companies = await companyService.getCompanies();
      sendSuccess(res, 200, "Lấy danh sách công ty thành công", { items: companies });
    } catch (err) {
      next(err);
    }
  }

  async getCompanyById(req, res, next) {
    try {
      const company = await companyService.getCompanyById(req.params.id);
      sendSuccess(res, 200, "Lấy công ty thành công", company);
    } catch (err) {
      next(err);
    }
  }

  async createCompany(req, res, next) {
    try {
      const company = await companyService.createCompany(req.body);
      sendSuccess(res, 201, "Tạo công ty thành công", company);
    } catch (err) {
      next(err);
    }
  }

  async updateCompany(req, res, next) {
    try {
      const company = await companyService.updateCompany(req.params.id, req.body);
      sendSuccess(res, 200, "Cập nhật công ty thành công", company);
    } catch (err) {
      next(err);
    }
  }

  async deleteCompany(req, res, next) {
    try {
      const force = req.query.force === "true";
      await companyService.deleteCompany(req.params.id, force);
      sendSuccess(res, 200, "Xóa công ty thành công");
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CompanyController();
