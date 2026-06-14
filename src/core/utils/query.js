const vnMap = {
  'a': '[aAáÁàÀảẢãÃạẠăĂắẮằẰẳẲẵẴặẶâÂấẤầẦẩẨẫẪậẬ]',
  'd': '[dDđĐ]',
  'e': '[eEéÉèÈẻẺẽẼẹẸêÊếẾềỀểỂễỄệỆ]',
  'i': '[iIíÍìÌỉỈĩĨịỊ]',
  'o': '[oOóÓòÒỏỎõÕọỌôÔốỐồỒổỔỗỖộỘơƠớỚờỜởỞỡỠợỢ]',
  'u': '[uUúÚùÙủỦũŨụỤưƯứỨừỪửỬữỮựỰ]',
  'y': '[yYýÝỳỲỷỶỹỸỵỴ]'
};

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildVietnameseRegexPattern(value) {
  let pattern = '';
  // Convert to base characters (e.g. tường -> tuong, đ -> d)
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i].toLowerCase();
    if (vnMap[char]) {
      pattern += vnMap[char] + '[\\u0300-\\u036f]*';
    } else {
      pattern += escapeRegex(normalized[i]) + '[\\u0300-\\u036f]*';
    }
  }
  return pattern;
}

function buildSearchRegex(value = "") {
  if (!value.trim()) {
    return null;
  }

  const pattern = buildVietnameseRegexPattern(value.trim());
  return new RegExp(pattern, "i");
}

module.exports = {
  buildSearchRegex,
  escapeRegex,
};
