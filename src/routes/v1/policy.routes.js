const express = require('express');
const projectBonusRouter = require('./projectBonus.routes');

const router = express.Router();

// Tab con: Thưởng dự án
router.use('/project-bonus', projectBonusRouter);

// Sẽ còn các tab con khác sau này...
// router.use('/other-policy', otherPolicyRouter);

module.exports = router;
