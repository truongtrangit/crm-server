const mongoose = require('mongoose');
const { KNOWLEDGE_STATUS } = require('../../../core/constants/appData');
const { ID_PREFIXES, generateMonotonicId } = require('../../../core/utils/id');

const knowledgeSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    coverImage: { type: String },
    status: { 
      type: String, 
      enum: Object.values(KNOWLEDGE_STATUS), 
      default: KNOWLEDGE_STATUS.DRAFT 
    },
    
    // Knowledge content
    content: { type: String },

    // Relations
    category: [{ type: String, ref: 'KnowledgeCategory' }],
    author: { type: String },

    // Flags & Stats
    isHot: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0 },
    publishedAt: { type: Date },
    createdBy: { type: String, ref: 'User' },

    // Soft delete
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for category details
knowledgeSchema.virtual('categoryDetails', {
  ref: 'KnowledgeCategory',
  localField: 'category',
  foreignField: 'id',
  justOne: false,
});

knowledgeSchema.pre('save', async function () {
  if (this.isNew && !this.id) {
    this.id = await generateMonotonicId(ID_PREFIXES.KNOWLEDGE);
  }
});

module.exports = mongoose.model('Knowledge', knowledgeSchema);
