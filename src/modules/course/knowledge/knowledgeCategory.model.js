const mongoose = require('mongoose');
const { ID_PREFIXES, generateMonotonicId } = require('../../../core/utils/id');

const knowledgeCategorySchema = new mongoose.Schema(
  {
    id: { type: String, unique: true },
    name: { type: String, required: true },
    parentId: { type: String, default: '' },
    icon: { type: String, default: '' },
    logo: { type: String, default: '' },
    color: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

knowledgeCategorySchema.pre('save', async function () {
  if (this.isNew && !this.id) {
    this.id = await generateMonotonicId(ID_PREFIXES.KNOWLEDGE_CATEGORY);
  }
});

module.exports = mongoose.model('KnowledgeCategory', knowledgeCategorySchema);
