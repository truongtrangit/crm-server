require("dotenv").config();
const mongoose = require("mongoose");
const Lead = require("../src/models/Lead");
const Event = require("../src/models/Event");
const Task = require("../src/models/Task");
const MetaProgram = require("../src/models/MetaProgram");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/crm";

async function migrateCreatedBy() {
  try {
    console.log("Đang kết nối database...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Đã kết nối MongoDB.");

    console.log("⏳ Đang migrate Leads...");
    const leads = await Lead.find({ $or: [{ createdBy: null }, { createdBy: "" }] });
    let leadCount = 0;
    for (const lead of leads) {
      if (lead.activityLogs && lead.activityLogs.length > 0) {
        const creatorId = lead.activityLogs[lead.activityLogs.length - 1].performedBy?.userId;
        const creatorName = lead.activityLogs[lead.activityLogs.length - 1].performedBy?.userName;
        lead.createdBy = creatorId || creatorName || "SYSTEM";
      } else {
        lead.createdBy = "SYSTEM";
      }
      await lead.save();
      leadCount++;
    }
    console.log(`✅ Đã migrate ${leadCount} Leads.`);

    console.log("⏳ Đang migrate Events...");
    const events = await Event.find({ $or: [{ createdBy: null }, { createdBy: "" }] });
    let eventCount = 0;
    for (const event of events) {
      if (event.timeline && event.timeline.length > 0) {
        const creatorName = event.timeline[event.timeline.length - 1].createdBy;
        event.createdBy = creatorName || "SYSTEM";
      } else {
        event.createdBy = "SYSTEM";
      }
      await event.save();
      eventCount++;
    }
    console.log(`✅ Đã migrate ${eventCount} Events.`);

    console.log("⏳ Đang migrate Tasks...");
    const tasks = await Task.find({ $or: [{ createdBy: null }, { createdBy: "" }] });
    let taskCount = 0;
    for (const task of tasks) {
      task.createdBy = "SYSTEM";
      await task.save();
      taskCount++;
    }
    console.log(`✅ Đã migrate ${taskCount} Tasks.`);

    console.log("⏳ Đang migrate MetaPrograms...");
    const programs = await MetaProgram.find({ $or: [{ createdBy: null }, { createdBy: "" }] });
    let programCount = 0;
    for (const program of programs) {
      program.createdBy = "SYSTEM";
      await program.save();
      programCount++;
    }
    console.log(`✅ Đã migrate ${programCount} MetaPrograms.`);

    console.log("🎉 Migration hoàn tất!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi migration:", err);
    process.exit(1);
  }
}

migrateCreatedBy();
