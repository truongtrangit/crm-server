const Joi = require("joi");
const { STAFF_STATUS, SALARY_FORMATS } = require("../constants/finance");

const companyProportion = Joi.object({
  company: Joi.string().required(),
  percentage: Joi.number().min(0).max(100).required(),
});

const salaryConfigSchema = Joi.object({
  basicSalary: Joi.number().required(),
  format: Joi.string()
    .valid(...Object.values(SALARY_FORMATS))
    .required(),
  effectiveDate: Joi.date().required(),
  companyProportions: Joi.array().items(companyProportion).min(1).required().custom((value, helpers) => {
    const sum = value.reduce((acc, curr) => acc + curr.percentage, 0);
    if (sum !== 100) {
      return helpers.message("Tổng tỉ trọng công ty chi trả phải bằng 100%");
    }
    return value;
  }),
  insuranceSalary: Joi.number().allow(null, ""),
  note: Joi.string().allow(null, ""),
});

const addSalaryConfigSchema = Joi.object({
  staffId: Joi.string().required(),
}).concat(salaryConfigSchema);

const createStaffSchema = Joi.object({
  name: Joi.string().required(),
  userId: Joi.string().allow(null, ""),
  companies: Joi.array().items(Joi.string()).min(1).required(),
  functionalGroupId: Joi.string().required(),
  status: Joi.string().valid(...Object.values(STAFF_STATUS)),
  onboardDate: Joi.date().allow(null, ""),
  probationEndDate: Joi.date().allow(null, ""),
  resignationDate: Joi.date().allow(null, ""),
  cvLink: Joi.string().allow(null, ""),
  summary: Joi.string().allow(null, ""),
  salaryConfigs: Joi.array().items(salaryConfigSchema).allow(null, ""),
});

const getStaffsQuerySchema = Joi.object({
  status: Joi.string().valid(...Object.values(STAFF_STATUS)).optional(),
  company: Joi.string().optional(),
  functionalGroupId: Joi.string().optional(),
  search: Joi.string().allow("").optional(),
  sortBy: Joi.string().optional(),
  limit: Joi.number().integer().optional(),
  page: Joi.number().integer().optional(),
});

const updateStaffSchema = Joi.object({
  name: Joi.string().optional(),
  userId: Joi.string().allow(null, ""),
  companies: Joi.array().items(Joi.string()).min(1).optional(),
  functionalGroupId: Joi.string().optional(),
  status: Joi.string().valid(...Object.values(STAFF_STATUS)).optional(),
  onboardDate: Joi.date().allow(null, ""),
  probationEndDate: Joi.date().allow(null, ""),
  resignationDate: Joi.date().allow(null, ""),
  cvLink: Joi.string().allow(null, ""),
  summary: Joi.string().allow(null, ""),
  salaryConfigs: Joi.array().items(salaryConfigSchema).allow(null, ""),
});

module.exports = {
  createStaffSchema,
  updateStaffSchema,
  getStaffsQuerySchema,
  salaryConfigSchema,
  addSalaryConfigSchema,
};
