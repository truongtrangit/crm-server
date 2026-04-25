/**
 * softDelete plugin — adds `isDeleted` + `deletedAt` fields and auto-filters queries.
 *
 * Usage:
 *   schema.plugin(softDeletePlugin);
 *
 * Behavior:
 *   - Adds `isDeleted: Boolean` (indexed, default false) and `deletedAt: Date` (default null)
 *   - All find/count queries automatically exclude soft-deleted docs (isDeleted: false)
 *   - To include deleted docs, use Model.findWithDeleted(filter)
 *   - doc.softDelete() marks as deleted (isDeleted=true, deletedAt=now)
 *   - doc.restore() restores (isDeleted=false, deletedAt=null)
 */
function softDeletePlugin(schema) {
  // ── Add fields ──
  schema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  });

  // ── Auto-filter: find, findOne, findOneAndUpdate, etc. ──
  const queryMiddlewares = [
    "find",
    "findOne",
    "findOneAndUpdate",
    "findOneAndReplace",
    "findOneAndDelete",
    "countDocuments",
    "estimatedDocumentCount",
  ];

  for (const method of queryMiddlewares) {
    schema.pre(method, function () {
      // Skip filter if caller explicitly set _includeDeleted
      if (this.getOptions()?._includeDeleted) return;
      // Only add filter if not already present
      if (this.getFilter().isDeleted !== undefined) return;
      this.where({ isDeleted: false });
    });
  }

  // ── Auto-filter: aggregate ──
  schema.pre("aggregate", function () {
    const pipeline = this.pipeline();
    // If the first stage is already a $match with isDeleted, skip
    const firstStage = pipeline[0];
    if (firstStage?.$match?.isDeleted !== undefined) return;
    // Prepend $match to exclude soft-deleted
    pipeline.unshift({ $match: { isDeleted: false } });
  });

  // ── Instance methods ──
  schema.methods.softDelete = function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
  };

  schema.methods.restore = function () {
    this.isDeleted = false;
    this.deletedAt = null;
    return this.save();
  };

  // ── Static: query including soft-deleted docs ──
  schema.statics.findWithDeleted = function (filter = {}) {
    return this.find(filter).setOptions({ _includeDeleted: true });
  };

  schema.statics.findOneWithDeleted = function (filter = {}) {
    return this.findOne(filter).setOptions({ _includeDeleted: true });
  };

  schema.statics.countWithDeleted = function (filter = {}) {
    return this.countDocuments(filter).setOptions({ _includeDeleted: true });
  };
}

module.exports = { softDeletePlugin };
