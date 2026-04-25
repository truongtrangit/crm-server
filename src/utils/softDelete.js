/**
 * softDelete plugin — adds `deletedAt` field and auto-filters queries.
 *
 * Usage:
 *   schema.plugin(softDeletePlugin);
 *
 * Behavior:
 *   - Adds `deletedAt: Date` field (null = active, Date = soft-deleted)
 *   - All find/count queries automatically exclude soft-deleted docs
 *   - To include deleted docs, use Model.findWithDeleted(filter)
 *   - doc.softDelete() marks as deleted
 *   - doc.restore() restores
 */
function softDeletePlugin(schema) {
  // ── Add field ──
  schema.add({ deletedAt: { type: Date, default: null } });

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
      if (this.getFilter().deletedAt !== undefined) return;
      this.where({ deletedAt: null });
    });
  }

  // ── Auto-filter: aggregate ──
  schema.pre("aggregate", function () {
    const pipeline = this.pipeline();
    // If the first stage is already a $match with deletedAt, skip
    const firstStage = pipeline[0];
    if (firstStage?.$match?.deletedAt !== undefined) return;
    // Prepend $match to exclude soft-deleted
    pipeline.unshift({ $match: { deletedAt: null } });
  });

  // ── Instance methods ──
  schema.methods.softDelete = function () {
    this.deletedAt = new Date();
    return this.save();
  };

  schema.methods.restore = function () {
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
