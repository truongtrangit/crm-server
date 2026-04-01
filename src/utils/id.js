function padNumber(value, width = 3) {
  return String(value).padStart(width, "0");
}

async function generateSequentialId(Model, prefix, width = 3) {
  const latest = await Model.findOne({ id: new RegExp(`^${prefix}`) })
    .sort({ createdAt: -1, id: -1 })
    .lean();

  if (!latest?.id) {
    return `${prefix}${padNumber(1, width)}`;
  }

  const rawNumber = latest.id.replace(prefix, "").replace(/\D/g, "");
  const nextNumber = Number(rawNumber || 0) + 1;

  return `${prefix}${padNumber(nextNumber, width)}`;
}

async function generateTaskId(Model) {
  const latest = await Model.findOne({ id: /^#/ })
    .sort({ createdAt: -1, id: -1 })
    .lean();

  if (!latest?.id) {
    return "#00001";
  }

  const nextNumber = Number(latest.id.replace(/\D/g, "") || 0) + 1;
  return `#${padNumber(nextNumber, 5)}`;
}

module.exports = {
  generateSequentialId,
  generateTaskId,
};
