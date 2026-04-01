const mongoose = require("mongoose");
const env = require("./env");

mongoose.set("strictQuery", true);

async function connectDatabase() {
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });

  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}

module.exports = {
  connectDatabase,
};
