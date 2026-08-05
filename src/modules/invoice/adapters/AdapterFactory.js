const BkavAdapter = require('./BkavAdapter');
const { INVOICE_PROVIDER_TYPES } = require('../../../core/constants/invoice');

/**
 * ─── AdapterFactory ──────────────────────────────────────────────────────────
 * Factory pattern: tạo adapter phù hợp dựa trên providerType.
 */
class AdapterFactory {
  /**
   * Tạo adapter instance cho provider.
   * @param {Object} providerConfig - InvoiceProvider document từ DB
   * @returns {BaseInvoiceAdapter}
   */
  static create(providerConfig) {
    if (!providerConfig || !providerConfig.providerType) {
      throw new Error('providerConfig và providerType là bắt buộc');
    }

    switch (providerConfig.providerType) {
      case INVOICE_PROVIDER_TYPES.BKAV:
        return new BkavAdapter(providerConfig);

      case INVOICE_PROVIDER_TYPES.SEPAY:
        // TODO Phase 3: SepayAdapter
        throw new Error('SePay adapter chưa được implement. Sẽ hỗ trợ trong Phase 3');

      default:
        throw new Error(`Không hỗ trợ provider type: ${providerConfig.providerType}`);
    }
  }
}

module.exports = AdapterFactory;
