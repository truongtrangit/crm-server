const mongoose = require('mongoose');

const ProjectBonusGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    contractValue: { type: String, default: null },
    referrer: { type: String, default: null },
    marketing: { type: String, default: null },
    dev: { type: String, default: null },
    sale: { type: String, default: null },
    support: { type: String, default: null },
  },
  { _id: true },
);

const projectBonusSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    groups: [ProjectBonusGroupSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('ProjectBonus', projectBonusSchema);
