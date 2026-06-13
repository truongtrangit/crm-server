const createHttpError = require("http-errors");
const Company = require('./company.model');
const { ID_PREFIXES, generateMonotonicId } = require('../../../core/utils/id');
const { computeChanges } = require('../../../core/utils/diff');

class CompanyService {
  async getCompanies() {
    return await Company.find().sort({ createdAt: -1 }).lean();
  }

  async getCompanyById(id) {
    const company = await Company.findOne({ id }).lean();
    if (!company) throw createHttpError(404, "Không tìm thấy công ty");
    return company;
  }

  async createCompany(data) {
    if (!data.name) throw createHttpError(400, "Tên công ty không được để trống");
    
    const existing = await Company.findOne({ name: data.name });
    if (existing) throw createHttpError(400, "Tên công ty đã tồn tại");

    const id = await generateMonotonicId(ID_PREFIXES.COMPANY);
    const company = new Company({
      ...data,
      id
    });
    
    await company.save();
    return company;
  }

  async updateCompany(id, data) {
    const company = await Company.findOne({ id });
    if (!company) throw createHttpError(404, "Không tìm thấy công ty");

    if (data.name && data.name !== company.name) {
      const existing = await Company.findOne({ name: data.name });
      if (existing) throw createHttpError(400, "Tên công ty đã tồn tại");
    }

    const oldState = company.toObject();
    Object.assign(company, data);
    await company.save();
    const newState = company.toObject();
    const changes = computeChanges(oldState, newState);

    return { company, changes };
  }

  async deleteCompany(id, force = false) {
    const company = await Company.findOne({ id });
    if (!company) throw createHttpError(404, "Không tìm thấy công ty");

    const Staff = require('../staff/staff.model');

    if (!force) {
        const staffInUse = await Staff.exists({ "salaryConfigs.companyProportions.company": company.id });
        if (!staffInUse) {
            // Check by name as fallback for old data
            const staffInUseOld = await Staff.exists({ "salaryConfigs.companyProportions.company": company.name });
            if (staffInUseOld) {
                throw createHttpError(400, "RESOURCE_IN_USE");
            }
        } else {
            throw createHttpError(400, "RESOURCE_IN_USE");
        }
    } else {
        // Force Delete: Remove company proportions from staffs (both new and old references)
        await Staff.updateMany(
            {}, 
            { $pull: { "salaryConfigs.$[].companyProportions": { company: { $in: [company.id, company.name] } } } }
        );
    }

    await Company.deleteOne({ id });
    return company;
  }
}

module.exports = new CompanyService();
