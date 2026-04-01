const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const env = require('./config/env');
const { connectDatabase } = require('./config/database');
const { seedDatabase } = require('./services/seedDatabase');

async function bootstrap() {
  await connectDatabase();
  await seedDatabase();

  const server = http.createServer(app);

  server.listen(env.port, () => {
    console.log(`CRM server listening on http://localhost:${env.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received. Closing server...`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('Failed to start CRM server', error);
  process.exit(1);
});
