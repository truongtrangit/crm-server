function computePriceRange(data) {
  if (data.packages && Array.isArray(data.packages)) {
    if (data.packages.length > 0) {
      data.minPrice = Math.min(...data.packages.map(p => p.price || 0));
      data.maxPrice = Math.max(...data.packages.map(p => p.price || 0));
    } else {
      data.minPrice = 0;
      data.maxPrice = 0;
    }
  }
}

module.exports = {
  computePriceRange,
};
