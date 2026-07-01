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
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    groups: [ProjectBonusGroupSchema],
    createdBy: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  },
);

projectBonusSchema.virtual('creator', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: 'id',
  justOne: true,
});

module.exports = mongoose.model('ProjectBonus', projectBonusSchema);
