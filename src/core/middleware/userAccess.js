const User = require('../../modules/system/user/user.model');
const { requireResourceAccess } = require('./resourceAccess');

const userResourceAccess = requireResourceAccess({
  getResource: (req) => User.findOne({ id: req.params.id }),
  getCreatorId: (targetUser) => targetUser.createdBy,
  getTargetUserId: (targetUser) => targetUser.id,
  allowCreator: true,
  allowManagerSubordinateCreator: true,
  allowManagerSubordinateTarget: true,
  allowUnassigned: false,
});

module.exports = { userResourceAccess };
