const { Router } = require("express");
const onlineCoursesRouter = require("./onlineCourses.routes");
const {
  requireExternalApiKey,
} = require("../../../core/middleware/externalAuth");

const externalV1Router = Router();

// Áp dụng middleware kiểm tra API Key cho toàn bộ /api/external/v1
externalV1Router.use(requireExternalApiKey);

// Các external endpoints
externalV1Router.use("/online", onlineCoursesRouter);

module.exports = externalV1Router;
