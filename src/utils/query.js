function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchRegex(value = "") {
  if (!value.trim()) {
    return null;
  }

  return new RegExp(escapeRegex(value.trim()), "i");
}

module.exports = {
  buildSearchRegex,
};
