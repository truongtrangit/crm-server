const http = require("http");
const mongoose = require("mongoose");
const app = require("./app");
const env = require("./config/env");
const { connectDatabase } = require("./config/database");
const { seedDatabase } = require("./services/seedDatabase");
const logger = require("./utils/logger");

async function bootstrap() {
  await connectDatabase();
  await seedDatabase();

  const server = http.createServer(app);

  server.listen(env.port, () => {
    logger.info(`CRM server listening on http://localhost:${env.port}`, {
      port: env.port,
      env: env.nodeEnv,
    });
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received. Closing server...`);
    server.close(async () => {
      await mongoose.connection.close();
      logger.info("Server closed gracefully");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  logger.error("Failed to start CRM server", { error: error.message, stack: error.stack });
  process.exit(1);
});
