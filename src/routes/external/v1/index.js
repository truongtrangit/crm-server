const { Router } = require("express");
const coursesRouter = require('./courses.routes');
const { requireExternalApiKey } = require('../../../core/middleware/externalAuth');

const externalV1Router = Router();

// Áp dụng middleware kiểm tra API Key cho toàn bộ /api/external/v1
externalV1Router.use(requireExternalApiKey);

// Các external endpoints
externalV1Router.use("/courses", coursesRouter);

module.exports = externalV1Router;
