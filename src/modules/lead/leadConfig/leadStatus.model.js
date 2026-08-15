const mongoose = require("mongoose");
const { LEAD_STATUS_TYPES } = require('../../../core/constants/leadConfig');

const leadStatusSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: LEAD_STATUS_TYPES,
      required: true,
    },
    color: { type: String, default: "#f1f5f9" },
    isDefault: { type: Boolean, default: false },
    isTemplate: { type: Boolean, default: true },
    funnelId: { type: String, ref: 'Funnel', default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  }
);

// Middleware to ensure only one active default status exists
leadStatusSchema.pre("save", async function () {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
});

leadStatusSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate();
  if (update.isDefault || (update.$set && update.$set.isDefault)) {
    const docToUpdate = await this.model.findOne(this.getQuery());
    await this.model.updateMany(
      { _id: { $ne: docToUpdate._id } },
      { $set: { isDefault: false } }
    );
  }
});

module.exports = mongoose.model("LeadStatus", leadStatusSchema);
