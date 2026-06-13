const mongoose = require("mongoose");

const blockAutomationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    // Bearer token for authorization with the third-party API
    authToken: { type: String, default: "", trim: true },
    // HTTP method to use when calling the API
    method: {
      type: String,
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      default: "POST",
    },
    // JSON template with {{eventFieldPath}} placeholders
    // e.g. { "customer": { "email": "{{customer.email}}" }, "attrs": [...] }
    // At runtime, {{...}} gets replaced with actual Event data
    payloadTemplate: { type: String, default: "{}" },
    // Optional description
    description: { type: String, default: "" },
    // Whether this block automation is active
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("BlockAutomation", blockAutomationSchema);
