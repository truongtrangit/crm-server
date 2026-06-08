const mongoose = require("mongoose");

const courseHashtagSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, unique: true }, // Format: #Hashtag
    color: { type: String, default: "#0668e1" },
  },
  { timestamps: true, versionKey: false, id: false },
);

module.exports = mongoose.model("CourseHashtag", courseHashtagSchema);
