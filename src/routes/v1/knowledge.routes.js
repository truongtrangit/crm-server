const express = require('express');
const router = express.Router();
const knowledgeController = require('../../modules/course/knowledge/knowledge.controller');
const {
  authenticateRequest,
  requirePermission,
} = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');
const validate = require('../../core/middleware/validate');
const {
  createKnowledgeSchema,
  updateKnowledgeSchema,
  categorySchema,
} = require('../../modules/course/knowledge/knowledge.validation');

router.use(authenticateRequest);

// Categories
router.get(
  '/categories',
  requirePermission(PERMISSIONS.COURSES_KNOWLEDGE_READ),
  knowledgeController.getCategories,
);
router.post(
  '/categories',
  requirePermission(PERMISSIONS.COURSES_KNOWLEDGE_CREATE),
  validate(categorySchema),
  knowledgeController.createCategory,
);
router.put(
  '/categories/:id',
  requirePermission(PERMISSIONS.COURSES_KNOWLEDGE_UPDATE),
  validate(categorySchema),
  knowledgeController.updateCategory,
);
router.delete(
  '/categories/:id',
  requirePermission(PERMISSIONS.COURSES_KNOWLEDGE_DELETE),
  knowledgeController.deleteCategory,
);

// Knowledge CRUD
router.get(
  '/',
  requirePermission(PERMISSIONS.COURSES_KNOWLEDGE_READ),
  knowledgeController.getKnowledgeList,
);
router.post(
  '/',
  requirePermission(PERMISSIONS.COURSES_KNOWLEDGE_CREATE),
  validate(createKnowledgeSchema),
  knowledgeController.createKnowledge,
);
router.get(
  '/:id',
  requirePermission(PERMISSIONS.COURSES_KNOWLEDGE_READ),
  knowledgeController.getKnowledgeById,
);
router.get(
  '/:id/readers',
  requirePermission(PERMISSIONS.COURSES_KNOWLEDGE_READ),
  knowledgeController.getReaders,
);
router.put(
  '/:id',
  requirePermission(PERMISSIONS.COURSES_KNOWLEDGE_UPDATE),
  validate(updateKnowledgeSchema),
  knowledgeController.updateKnowledge,
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.COURSES_KNOWLEDGE_DELETE),
  knowledgeController.deleteKnowledge,
);

module.exports = router;
