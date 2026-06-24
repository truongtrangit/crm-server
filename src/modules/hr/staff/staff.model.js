const mongoose = require("mongoose");
const { softDeletePlugin } = require('../../../core/utils/softDelete');
const { STAFF_STATUS, SALARY_FORMATS } = require('../../../core/constants/finance');

const CompanyProportionSchema = new mongoose.Schema(
  {
    company: { type: String, required: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const SalaryConfigSchema = new mongoose.Schema(
  {
    basicSalary: { type: Number, required: true },
    format: {
      type: String,
      enum: Object.values(SALARY_FORMATS),
      required: true,
    },
    effectiveDate: { type: Date, required: true },
    companyProportions: [CompanyProportionSchema],
    insuranceSalary: { type: Number },
    insuranceAmount: { type: Number },
    isCompanyPayInsurance: { type: Boolean, default: false },
    companyInsuranceAmount: { type: Number },
    isStaffPayInsurance: { type: Boolean, default: false },
    staffInsuranceAmount: { type: Number },
    bhxh: { type: Number },
    pit: { type: Number },
    note: { type: String },
    createdBy: { type: String }, // user id
  },
  {
    timestamps: true,
  }
);

const StaffSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional link to CRM user
    companies: [{ type: String, required: true }],
    functionalGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FunctionalGroup",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(STAFF_STATUS),
      default: STAFF_STATUS.ACTIVE,
    },
    onboardDate: { type: Date },
    probationEndDate: { type: Date },
    resignationDate: { type: Date },
    cvLink: { type: String },
    summary: { type: String },
    salaryConfigs: [SalaryConfigSchema],
    createdBy: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  }
);


StaffSchema.plugin(softDeletePlugin);

// To avoid duplicate active staffs with the same name/user if needed, but for now just simple CRUD
// You can add indexes later if needed.

module.exports = mongoose.model("Staff", StaffSchema);
