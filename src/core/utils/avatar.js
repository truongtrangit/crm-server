function getDefaultAvatar(name) {
  const fallbackName = name ? encodeURIComponent(name) : "U";
  return `https://ui-avatars.com/api/?name=${fallbackName}&background=random`;
}

module.exports = { getDefaultAvatar };
