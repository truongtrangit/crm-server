const { Router } = require('express');
const onlineCoursesRouter = require('./onlineCourses.routes');
const challengesRouter = require('./challenges.routes');
const {

  checkBotvnMaintenance,
  checkBotvnMenu,
} = require('../../../core/middleware/botvnConfigAccess');

const externalV1Router = Router();

// Các router sử dụng key riêng sẽ được khai báo trước middleware này
externalV1Router.use('/zcodes', require('./zcodes.routes'));



// Các external endpoints không bị chặn bởi maintenance
externalV1Router.use('/config', require('./config.routes'));
externalV1Router.use('/auth', require('./auth.routes'));

// Áp dụng middleware kiểm tra bảo trì cho các endpoints còn lại
externalV1Router.use(checkBotvnMaintenance);

externalV1Router.use('/online', checkBotvnMenu('online'), onlineCoursesRouter);
externalV1Router.use(
  '/offline',
  checkBotvnMenu('offline'),
  require('./coursesOffline.routes'),
);
externalV1Router.use(
  '/challenges',
  checkBotvnMenu('challenge'),
  challengesRouter,
);
externalV1Router.use(
  '/knowledge',
  checkBotvnMenu('knowledge'),
  require('./knowledge.routes'),
);

externalV1Router.use('/credits', require('./credits.routes'));
externalV1Router.use('/checkout', require('./checkout.routes'));
externalV1Router.use('/enrollments', require('./enrollment.routes'));
externalV1Router.use('/favorites', require('./favorites.routes'));
externalV1Router.use('/submissions', require('./submissions.routes'));

module.exports = externalV1Router;
