/**
 * Migration Script: Backfill `createdBy` for existing Event, Lead, Task records.
 *
 * Strategy:
 * - Lead: Lấy từ activityLogs[0].performedBy.userId (log "create")
 * - Event: Lấy từ timeline[0].createdBy (tên) → tìm User theo name (fallback null)
 * - Task: Lấy từ logs[0].user.id (log "create")
 *
 * Usage:  node src/scripts/migrateCreatedBy.js
 *
 * Safe to run multiple times — chỉ update records có createdBy = null.
 */

require("../config/env");
const mongoose = require("mongoose");
const env = require("../config/env");

async function run() {
  console.log("🔄 Connecting to MongoDB...");
  await mongoose.connect(env.mongoUri);
  console.log("✅ Connected.\n");

  // Load models after connection
  const Event = require("../models/Event");
  const Lead = require("../models/Lead");
  const Task = require("../models/Task");
  const User = require("../models/User");

  // ─── Lead: activityLogs[0].performedBy.userId ──────────────────────────────
  console.log("── Migrating Leads ──");
  const leads = await Lead.find({ createdBy: null });
  let leadUpdated = 0;
  for (const lead of leads) {
    const createLog = (lead.activityLogs || []).find(
      (log) => log.action === "create"
    );
    const userId = createLog?.performedBy?.userId || null;
    if (userId) {
      lead.createdBy = userId;
      await lead.save();
      leadUpdated++;
    }
  }
  console.log(`   Leads: ${leadUpdated}/${leads.length} updated\n`);

  // ─── Task: logs[0].user.id ─────────────────────────────────────────────────
  console.log("── Migrating Tasks ──");
  const tasks = await Task.find({ createdBy: null });
  let taskUpdated = 0;
  for (const task of tasks) {
    const createLog = (task.logs || []).find((log) => log.action === "create");
    const userId = createLog?.user?.id || null;
    if (userId) {
      task.createdBy = userId;
      await task.save();
      taskUpdated++;
    }
  }
  console.log(`   Tasks: ${taskUpdated}/${tasks.length} updated\n`);

  // ─── Event: timeline[0].createdBy (tên) → tìm User ────────────────────────
  console.log("── Migrating Events ──");
  const events = await Event.find({ createdBy: null });
  let eventUpdated = 0;

  // Build name→id map for quick lookup
  const allUsers = await User.find({}, { id: 1, name: 1 }).lean();
  const nameToId = new Map();
  for (const u of allUsers) {
    if (u.name) nameToId.set(u.name.trim().toLowerCase(), u.id);
  }

  for (const event of events) {
    // Strategy 1: Check first assignee (most likely the creator in early data)
    const firstAssignee = (event.assignees || [])[0];
    if (firstAssignee?.userId) {
      event.createdBy = firstAssignee.userId;
      await event.save();
      eventUpdated++;
      continue;
    }

    // Strategy 2: Match timeline "Sự kiện được tạo" entry creator name
    const createEntry = (event.timeline || []).find(
      (entry) =>
        entry.title === "Sự kiện được tạo" ||
        entry.type === "event"
    );
    const creatorName = createEntry?.createdBy;
    if (creatorName && creatorName !== "System") {
      const userId = nameToId.get(creatorName.trim().toLowerCase());
      if (userId) {
        event.createdBy = userId;
        await event.save();
        eventUpdated++;
        continue;
      }
    }
  }
  console.log(`   Events: ${eventUpdated}/${events.length} updated\n`);

  console.log("✅ Migration complete!");
  console.log(`   Total: ${leadUpdated + taskUpdated + eventUpdated} records updated`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
