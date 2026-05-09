/**
 * Migration: Convert Event assignee (single) → assignees (array)
 *
 * Converts existing events from the old schema:
 *   { assigneeId: "USER1", assignee: { name, avatar, role, department, group } }
 * to the new multi-assignee schema:
 *   { assignees: [{ userId, userName, userAvatar, functionId, functionTitle }] }
 *
 * Usage:  node src/scripts/migrateEventAssignees.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

async function run() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/crm";
  await mongoose.connect(uri);
  console.log("Connected to", uri);

  const db = mongoose.connection.db;
  const col = db.collection("events");

  // Find all events that still have the old assigneeId field
  const cursor = col.find({ assigneeId: { $exists: true } });
  let updated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    const assignees = [];

    // If assigneeId is non-null, migrate it into the new array
    if (doc.assigneeId) {
      assignees.push({
        userId: doc.assigneeId,
        userName: doc.assignee?.name || "",
        userAvatar: doc.assignee?.avatar || "",
        functionId: null,
        functionTitle: "",
      });
    }

    await col.updateOne(
      { _id: doc._id },
      {
        $set: { assignees },
        $unset: { assigneeId: "", assignee: "" },
      }
    );
    updated++;
  }

  // Also handle events that have assigneeId: null (set empty array)
  const nullResult = await col.updateMany(
    { assigneeId: null },
    {
      $set: { assignees: [] },
      $unset: { assigneeId: "", assignee: "" },
    }
  );
  skipped = nullResult.modifiedCount;

  console.log(`Migration complete: ${updated} events converted, ${skipped} null-assignee events cleaned up.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
