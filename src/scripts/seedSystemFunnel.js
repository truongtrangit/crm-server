/**
 * seedSystemFunnel.js — Tạo phễu hệ thống mặc định (idempotent).
 *
 * Gồm:
 *   1. 4 LeadStatus chuẩn
 *   2. 1 LeadStatusGroup "Chuẩn" chứa 4 status trên
 *   3. 1 FunnelFolder "Hệ thống"
 *   4. 1 FunnelGroup  "Phễu chuẩn"
 *   5. 1 Funnel       "Phễu mặc định"
 *
 * Tất cả đều dùng ID cố định → chạy lại không gây trùng.
 */

const LeadStatus = require("../modules/lead/leadConfig/leadStatus.model");
const LeadStatusGroup = require("../modules/lead/leadConfig/leadStatusGroup.model");
const FunnelFolder = require("../modules/lead/funnel/funnelFolder.model");
const FunnelGroup = require("../modules/lead/funnel/funnelGroup.model");
const Funnel = require("../modules/lead/funnel/funnel.model");

const { SYSTEM_IDS, SYSTEM_STATUSES, SYSTEM_STATUS_IDS } = require("../core/constants/systemFunnel");

async function seedSystemFunnel() {
  // ── 1. Lead Statuses ───────────────────────────────────────────────────────
  let statusCreated = 0;
  for (const s of SYSTEM_STATUSES) {
    const exists = await LeadStatus.findOne({ id: s.id }).lean();
    if (!exists) {
      await LeadStatus.create(s);
      statusCreated++;
    }
  }
  console.log(`   ✓ System LeadStatuses: ${statusCreated} tạo mới, ${SYSTEM_STATUSES.length - statusCreated} đã tồn tại`);

  // ── 2. Lead Status Group ──────────────────────────────────────────────────
  const sgExists = await LeadStatusGroup.findOne({ id: SYSTEM_IDS.STATUS_GROUP }).lean();
  if (!sgExists) {
    await LeadStatusGroup.create({
      id: SYSTEM_IDS.STATUS_GROUP,
      name: "Chuẩn (Hệ thống)",
      statusIds: SYSTEM_STATUS_IDS,
      isDefault: true,
      isActive: true,
    });
    console.log("   ✓ System LeadStatusGroup: tạo mới");
  } else {
    console.log("   ⚠  System LeadStatusGroup: đã tồn tại — bỏ qua");
  }

  // ── 3. Funnel Folder ──────────────────────────────────────────────────────
  const folderExists = await FunnelFolder.findOne({ id: SYSTEM_IDS.FOLDER }).lean();
  if (!folderExists) {
    await FunnelFolder.create({
      id: SYSTEM_IDS.FOLDER,
      name: "Hệ thống",
      statusGroupId: SYSTEM_IDS.STATUS_GROUP,
    });
    console.log("   ✓ System FunnelFolder: tạo mới");
  } else {
    console.log("   ⚠  System FunnelFolder: đã tồn tại — bỏ qua");
  }

  // ── 4. Funnel Group ───────────────────────────────────────────────────────
  const fgExists = await FunnelGroup.findOne({ id: SYSTEM_IDS.GROUP }).lean();
  if (!fgExists) {
    await FunnelGroup.create({
      id: SYSTEM_IDS.GROUP,
      name: "Phễu chuẩn",
      folderId: SYSTEM_IDS.FOLDER,
      statusGroupId: SYSTEM_IDS.STATUS_GROUP,
    });
    console.log("   ✓ System FunnelGroup: tạo mới");
  } else {
    console.log("   ⚠  System FunnelGroup: đã tồn tại — bỏ qua");
  }

  // ── 5. Funnel ─────────────────────────────────────────────────────────────
  const fnlExists = await Funnel.findOne({ id: SYSTEM_IDS.FUNNEL }).lean();
  if (!fnlExists) {
    await Funnel.create({
      id: SYSTEM_IDS.FUNNEL,
      name: "Phễu mặc định",
      folderId: SYSTEM_IDS.FOLDER,
      groupId: SYSTEM_IDS.GROUP,
      statusGroupId: SYSTEM_IDS.STATUS_GROUP,
      isActive: true,
    });
    console.log("   ✓ System Funnel: tạo mới");
  } else {
    console.log("   ⚠  System Funnel: đã tồn tại — bỏ qua");
  }
}

module.exports = { seedSystemFunnel };
