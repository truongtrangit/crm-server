const mongoose = require('mongoose');

const knowledgeReadSchema = new mongoose.Schema({
  knowledgeId: {
    type: String,
    ref: 'Knowledge',
    required: true,
    index: true
  },
  customerId: {
    type: String,
    ref: 'Customer',
    default: null,
    index: true
  },
  viewerKey: {
    type: String,
    required: true,
  },
  viewDate: {
    type: Date,
    required: true,
  },
  readAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  versionKey: false
});

// Ensure one view record per viewer per article per day
knowledgeReadSchema.index({ knowledgeId: 1, viewerKey: 1, viewDate: 1 }, { unique: true });

module.exports = mongoose.model('KnowledgeRead', knowledgeReadSchema);
