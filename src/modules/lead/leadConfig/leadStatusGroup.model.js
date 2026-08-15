const mongoose = require("mongoose");

const leadStatusGroupSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    statusIds: [{ type: String, ref: "LeadStatus" }],
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

// Middleware to ensure only one active default group exists
leadStatusGroupSchema.pre("save", async function () {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
});

leadStatusGroupSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate();
  if (update.isDefault || (update.$set && update.$set.isDefault)) {
    const docToUpdate = await this.model.findOne(this.getQuery());
    await this.model.updateMany(
      { _id: { $ne: docToUpdate._id } },
      { $set: { isDefault: false } }
    );
  }
});

module.exports = mongoose.model("LeadStatusGroup", leadStatusGroupSchema);
