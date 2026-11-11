const mongoose = require('mongoose');

const moduleConfigSchema = new mongoose.Schema(
  {
    modules: {
      customers: { type: Boolean, default: true },
      operations: { type: Boolean, default: true },
      meta: { type: Boolean, default: true },
      finance: { type: Boolean, default: true },
      zcode: { type: Boolean, default: true },
      bankLog: { type: Boolean, default: true },
      integration: { type: Boolean, default: true },
      invoice: { type: Boolean, default: true },
      jobhub: { type: Boolean, default: true },
      courses: { type: Boolean, default: true },
      staff: { type: Boolean, default: true },
      logs: { type: Boolean, default: true },
    },
    updatedBy: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('ModuleConfig', moduleConfigSchema);

