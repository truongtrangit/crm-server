const { sendError } = require('../utils/http');
const BotvnConfig = require('../../modules/course/courseConfig/botvnConfig.model');
const { optionalBotvnAuthenticateRequest } = require('./externalAuth');

// Middleware chặn khi BotVN đang bảo trì
const checkBotvnMaintenance = async (req, res, next) => {
  try {
    const config = await BotvnConfig.findOne();
    if (config && config.maintenance && config.maintenance.isActive) {
      return optionalBotvnAuthenticateRequest(req, res, () => {
        const user = req.user;
        const allowedRoles = config.maintenance.allowedRoles || [];

        if (user && user.botvnRole && allowedRoles.includes(user.botvnRole)) {
          return next();
        }

        return sendError(
          res,
          503,
          'Hệ thống đang bảo trì. Vui lòng quay lại sau.',
          {
            type: config.maintenance.type,
            title: config.maintenance.title,
            reason: config.maintenance.reason,
            time: config.maintenance.time,
          },
        );
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware kiểm tra menu của BotVN có đang được bật hay không
// menuKey có thể là: 'home', 'online', 'offline', 'challenge', 'nextMarketer'
const checkBotvnMenu = (menuKey) => {
  return async (req, res, next) => {
    try {
      const config = await BotvnConfig.findOne();
      // Mặc định nếu không có config thì cho phép truy cập
      if (config && config.menus && config.menus[menuKey] === false) {
        return sendError(res, 403, 'Tính năng này hiện đang bị vô hiệu hóa.');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  checkBotvnMaintenance,
  checkBotvnMenu,
};
