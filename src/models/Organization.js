const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    alias: { type: String, default: null, trim: true },
    parent: { type: String, required: true, trim: true },
    children: {
      type: [
        {
          alias: { type: String, default: null, trim: true },
          name: { type: String, required: true, trim: true },
          desc: { type: String, default: "" },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("Organization", organizationSchema);
