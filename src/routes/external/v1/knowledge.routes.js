const express = require('express');
const router = express.Router();
const knowledgeController = require('../../../modules/course/knowledge/knowledge.controller');
const {
  optionalBotvnAuthenticateRequest,
} = require('../../../core/middleware/externalAuth');
// External routes
router.get('/', (req, res, next) => {
  req.query.excludeContent = true;
  return knowledgeController.getKnowledgeList(req, res, next);
}); 
router.get('/hot', (req, res, next) => {
  req.query.excludeContent = true;
  return knowledgeController.getHotPosts(req, res, next);
});
router.get('/categories', knowledgeController.getCategories);
router.get(
  '/:identifier',
  optionalBotvnAuthenticateRequest,
  (req, res, next) => {
    req.query.status = 'published';
    return knowledgeController.getKnowledgeByIdentifier(req, res, next);
  }
);
router.get('/:id/related', knowledgeController.getRelatedPosts);

module.exports = router;
