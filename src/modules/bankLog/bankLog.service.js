const BankLogTransaction = require('./bankLogTransaction.model');
const BankLogRoutingRule = require('./bankLogRoutingRule.model');
const User = require('../system/user/user.model');
const { buildPaginatedResponse } = require('../../core/utils/pagination');
const { createHttpError } = require('../../core/utils/http');
const { generateMonotonicId, generateMonotonicIdsBatch, ID_PREFIXES } = require('../../core/utils/id');
const { BANK_LOG_TX_STATUSES, BANK_LOG_AUTH_TYPES } = require('../../core/constants/bankLog');
const { escapeRegex } = require('../../core/utils/query');
const CacheService = require('../../core/services/CacheService');
const httpClient = require('../../core/utils/httpClient');
const logger = require('../../core/utils/logger');
const { getStartOfDayVN } = require('../../core/utils/date');

const RULES_CACHE_KEY = 'banklog:rules';
const RULES_CACHE_TTL = 300; // 5 minutes

class BankLogService {
  constructor() {
    // Simple in-memory circuit breaker: url → { failures, lastFailure }
    this._circuitBreakers = new Map();
  }

  // ─── Transaction Methods ──────────────────────────────────────────────────

  async getTransactions(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (query.search) {
      const escaped = escapeRegex(query.search);
      filter.$or = [
        { txId: { $regex: escaped, $options: 'i' } },
        { sender: { $regex: escaped, $options: 'i' } },
        { content: { $regex: escaped, $options: 'i' } },
        { id: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (query.bank && query.bank !== 'all') {
      filter.bank = query.bank;
    }
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.rule) {
      if (query.rule === 'none') {
        filter.matchedRuleId = null;
      } else {
        filter.matchedRuleId = query.rule;
      }
    }

    const [items, total] = await Promise.all([
      BankLogTransaction.find(filter)
        .sort({ transactionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BankLogTransaction.countDocuments(filter),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async getTransactionById(id) {
    const tx = await BankLogTransaction.findOne({ id }).lean();
    if (!tx) throw createHttpError(404, 'Không tìm thấy giao dịch');
    return tx;
  }

  async getStats() {
    let todayStart = new Date();
    todayStart = getStartOfDayVN(todayStart);

    const [todayAmount, validCount, noRouteCount, totalCount, successCount] =
      await Promise.all([
        BankLogTransaction.aggregate([
          { $match: { createdAt: { $gte: todayStart } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        BankLogTransaction.countDocuments({
          createdAt: { $gte: todayStart },
          status: BANK_LOG_TX_STATUSES.SUCCESS,
        }),
        BankLogTransaction.countDocuments({
          createdAt: { $gte: todayStart },
          status: BANK_LOG_TX_STATUSES.NO_ROUTE,
        }),
        BankLogTransaction.countDocuments({
          createdAt: { $gte: todayStart },
        }),
        BankLogTransaction.countDocuments({
          status: BANK_LOG_TX_STATUSES.SUCCESS,
        }),
      ]);

    const totalAll = await BankLogTransaction.countDocuments();
    const successRate = totalAll > 0 ? ((successCount / totalAll) * 100).toFixed(1) : '0.0';

    return {
      todayReceived: todayAmount[0]?.total || 0,
      validTransactions: validCount,
      noRouteTransactions: noRouteCount,
      successRate: `${successRate}%`,
    };
  }

  /**
   * Ingest transaction from webhook.
   * SYNC: save to DB → return immediately.
   * ASYNC: evaluate rules + forward (fire-and-forget).
   */
  async ingestTransaction(payload) {
    const id = await generateMonotonicId(ID_PREFIXES.BANK_LOG_TX);

    let tx;
    try {
      tx = await BankLogTransaction.create({
        id,
        txId: payload.txId,
        bank: payload.bank,
        sender: payload.sender || null,
        amount: payload.amount,
        content: payload.content || null,
        transactionDate: payload.transactionDate || new Date(),
        // ACB-specific fields (null for non-ACB sources)
        debitOrCredit: payload.debitOrCredit || null,
        accountNumber: payload.accountNumber || null,
        transactionChannel: payload.transactionChannel || null,
        acbTransactionCode: payload.acbTransactionCode || null,
        acbClientRequestId: payload.acbClientRequestId || null,
        effectiveDate: payload.effectiveDate || null,
        status: BANK_LOG_TX_STATUSES.PENDING,
        rawPayload: payload,
        createdBy: 'system',
      });
    } catch (err) {
      if (err.code === 11000) {
        logger.info('Bank Log: Duplicate transaction ignored', { txId: payload.txId });
        return { txId: payload.txId, status: 'DUPLICATE', message: 'Transaction already ingested' };
      }
      throw err;
    }

    // Fire-and-forget: process in background
    this._processTransaction(tx).catch((err) =>
      logger.error('Bank Log: Background processing failed', {
        txId: tx.txId,
        error: err.message,
      }),
    );

    return { id: tx.id, txId: tx.txId, status: tx.status };
  }

  /**
   * Ingest batch of transactions from ACB webhook.
   * Maps ACB transaction fields → internal BankLogTransaction format.
   *
   * Optimized for performance & atomicity:
   *   - Batch ID generation: 1 DB call (generateMonotonicIdsBatch)
   *   - Bulk insert: 1 DB call (insertMany, ordered: false)
   *   - Duplicates silently skipped (dedup by txId unique index)
   *   - Background processing: single rules fetch, parallel fire-and-forget
   *
   * ACB doesn't provide a unique txId, so we generate a composite key:
   *   `ACB-{accountNumber}-{transactionCode}-{transactionDate}-{amount}`
   *
   * @param {Array} acbTransactions - Array of ACB transaction objects
   * @param {string} clientRequestId - ACB's clientRequestId for dedup tracking
   * @param {string} clientId - ACB's clientId
   * @returns {Array} Array of ingestion results
   */
  async ingestAcbBatch(acbTransactions, clientRequestId, clientId) {
    const count = acbTransactions.length;
    if (count === 0) return [];

    // 1 DB call: batch generate all IDs atomically
    const ids = await generateMonotonicIdsBatch(ID_PREFIXES.BANK_LOG_TX, count);

    // Map ACB fields → internal documents
    const docs = acbTransactions.map((acbTx, i) => {
      const txId = acbTx.transactionCode ? `ACB-${acbTx.transactionCode}` : `ACB-UNKNOWN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      // Determine if we should process this or just log it
      let initialStatus = BANK_LOG_TX_STATUSES.PENDING;
      if (
        acbTx.acbRequestCode !== 'TRANSACTION_UPDATE' ||
        acbTx.transactionStatus !== 'COMPLETED'
      ) {
        initialStatus = BANK_LOG_TX_STATUSES.IGNORED;
      }

      return {
        id: ids[i],
        txId,
        bank: 'ACB',
        sender: acbTx.transactionEntityAttribute?.remitterName || null,
        amount: acbTx.amount,
        content: acbTx.transactionContent || null,
        transactionDate: acbTx.transactionDate ? new Date(acbTx.transactionDate) : new Date(),
        debitOrCredit: acbTx.debitOrCredit,
        accountNumber: String(acbTx.accountNumber),
        transactionChannel: acbTx.transactionChannel || null,
        acbTransactionCode: acbTx.transactionCode || null,
        acbTransactionStatus: acbTx.transactionStatus || null,
        acbRequestCode: acbTx.acbRequestCode || null,
        acbClientId: clientId,
        acbClientRequestId: clientRequestId,
        effectiveDate: acbTx.effectiveDate ? new Date(acbTx.effectiveDate) : null,
        status: initialStatus,
        rawPayload: acbTx,
        createdBy: 'system',
      };
    });

    // 1 DB call: bulk insert, ordered:false → skip duplicates, don't fail batch
    let insertedDocs = [];
    try {
      const result = await BankLogTransaction.insertMany(docs, { ordered: false });
      insertedDocs = result;
    } catch (err) {
      // BulkWriteError: some inserts succeeded, some were duplicates
      if (err.code === 11000 || err.name === 'MongoBulkWriteError') {
        // insertedDocs = successfully written documents
        insertedDocs = err.insertedDocs || [];
        const dupCount = count - insertedDocs.length;
        if (dupCount > 0) {
          logger.info('Bank Log: ACB batch duplicates skipped', {
            total: count,
            inserted: insertedDocs.length,
            duplicates: dupCount,
            clientRequestId,
          });
        }
      } else {
        throw err;
      }
    }

    // Fire-and-forget: process all new transactions in background
    // Pre-fetch rules once for all transactions
    if (insertedDocs.length > 0) {
      const pendingDocs = insertedDocs.filter(d => d.status === BANK_LOG_TX_STATUSES.PENDING);
      
      if (pendingDocs.length > 0) {
        this._getActiveRules()
          .then((rules) => {
            for (const tx of pendingDocs) {
              this._processTransaction(tx, rules).catch((processErr) =>
                logger.error('Bank Log: Background processing failed', {
                  txId: tx.txId,
                  error: processErr.message,
                }),
              );
            }
          })
          .catch((rulesErr) => {
            logger.error('Bank Log: Failed to fetch rules for batch processing', {
              clientRequestId,
              error: rulesErr.message,
            });
          });
      }
    }

    // Build results: inserted + duplicates
    const insertedTxIds = new Set(insertedDocs.map((d) => d.txId));
    return docs.map((doc) => {
      if (insertedTxIds.has(doc.txId)) {
        return { id: doc.id, txId: doc.txId, status: doc.status };
      }
      return { txId: doc.txId, status: 'DUPLICATE', message: 'Transaction already ingested' };
    });
  }

  async retryTransaction(id) {
    const tx = await BankLogTransaction.findOne({ id });
    if (!tx) throw createHttpError(404, 'Không tìm thấy giao dịch');

    if (tx.status === BANK_LOG_TX_STATUSES.SUCCESS) {
      throw createHttpError(400, 'Giao dịch đã thành công, không cần retry');
    }

    tx.retryCount = (tx.retryCount || 0) + 1;
    tx.lastRetryAt = new Date();
    tx.status = BANK_LOG_TX_STATUSES.PENDING;
    await tx.save();

    // Fire-and-forget
    this._processTransaction(tx).catch((err) =>
      logger.error('Bank Log: Retry processing failed', {
        txId: tx.txId,
        error: err.message,
      }),
    );

    return { id: tx.id, txId: tx.txId, retryCount: tx.retryCount };
  }

  async dispatchTransaction(txId, ruleId) {
    const tx = await BankLogTransaction.findOne({ id: txId });
    if (!tx) throw createHttpError(404, 'Không tìm thấy giao dịch');

    if (tx.status === BANK_LOG_TX_STATUSES.SUCCESS) {
      throw createHttpError(400, 'Giao dịch đã thành công');
    }

    const rule = await BankLogRoutingRule.findOne({ id: ruleId }).lean();
    if (!rule) throw createHttpError(404, 'Không tìm thấy quy tắc');

    const startTime = Date.now();

    try {
      const result = await this._forwardToApi(tx, rule);

      await BankLogTransaction.updateOne(
        { _id: tx._id },
        {
          $set: {
            status: result.success
              ? BANK_LOG_TX_STATUSES.SUCCESS
              : BANK_LOG_TX_STATUSES.FAILED,
            matchedRuleName: rule.name,
            matchedRuleId: rule.id,
            targetApiUrl: rule.targetApi.url,
            apiResponseCode: result.statusCode,
            apiResponseBody: result.body,
            processingDurationMs: Date.now() - startTime,
            retryCount: (tx.retryCount || 0) + 1,
            lastRetryAt: new Date(),
          },
        },
      );

      return {
        id: tx.id,
        txId: tx.txId,
        ruleName: rule.name,
        status: result.success ? 'success' : 'failed',
        apiResponseCode: result.statusCode,
      };
    } catch (err) {
      await BankLogTransaction.updateOne(
        { _id: tx._id },
        {
          $set: {
            status: BANK_LOG_TX_STATUSES.FAILED,
            matchedRuleName: rule.name,
            matchedRuleId: rule.id,
            targetApiUrl: rule.targetApi.url,
            apiResponseBody: { error: err.message },
            processingDurationMs: Date.now() - startTime,
            retryCount: (tx.retryCount || 0) + 1,
            lastRetryAt: new Date(),
          },
        },
      ).catch(() => {});

      throw createHttpError(502, `Lỗi gọi API: ${err.message}`);
    }
  }

  // ─── Routing Rule Methods ─────────────────────────────────────────────────

  async getRules(query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (query.search) {
      const escaped = escapeRegex(query.search);
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { 'targetApi.url': { $regex: escaped, $options: 'i' } },
      ];
    }
    if (query.status === 'active') filter.isActive = true;
    if (query.status === 'inactive') filter.isActive = false;

    const [items, total] = await Promise.all([
      BankLogRoutingRule.find(filter)
        .sort({ priority: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BankLogRoutingRule.countDocuments(filter),
    ]);

    // Resolve createdBy IDs to user names
    const creatorIds = [...new Set(items.map((r) => r.createdBy).filter(Boolean))];
    if (creatorIds.length > 0) {
      const users = await User.find({ id: { $in: creatorIds } }, 'id name').lean();
      const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
      for (const item of items) {
        if (item.createdBy) {
          item.createdByName = userMap[item.createdBy] || item.createdBy;
        }
      }
    }

    return buildPaginatedResponse(items, total, page, limit);
  }

  async createRule(data, userId) {
    const id = await generateMonotonicId(ID_PREFIXES.BANK_LOG_RULE);

    const rule = await BankLogRoutingRule.create({
      id,
      ...data,
      createdBy: userId,
    });

    await CacheService.del(RULES_CACHE_KEY);
    return rule.toObject();
  }

  async updateRule(id, data) {
    const rule = await BankLogRoutingRule.findOneAndUpdate(
      { id },
      { $set: data },
      { new: true, runValidators: true },
    ).lean();

    if (!rule) throw createHttpError(404, 'Không tìm thấy quy tắc');

    await CacheService.del(RULES_CACHE_KEY);
    return rule;
  }

  async deleteRule(id) {
    const rule = await BankLogRoutingRule.findOneAndDelete({ id }).lean();
    if (!rule) throw createHttpError(404, 'Không tìm thấy quy tắc');

    await CacheService.del(RULES_CACHE_KEY);
    return rule;
  }

  // ─── Startup Recovery ─────────────────────────────────────────────────────

  async recoverPendingTransactions() {
    const cutoff = new Date(Date.now() - 60000); // older than 1 minute
    const pending = await BankLogTransaction.find({
      status: BANK_LOG_TX_STATUSES.PENDING,
      createdAt: { $lt: cutoff },
    });

    if (pending.length === 0) return;

    logger.info(`Bank Log: Recovering ${pending.length} pending transactions`);

    for (const tx of pending) {
      this._processTransaction(tx).catch((err) =>
        logger.error('Bank Log: Recovery processing failed', {
          txId: tx.txId,
          error: err.message,
        }),
      );
    }
  }

  /**
   * Process a single transaction: evaluate rules → forward to target API.
   * @param {Object} tx - BankLogTransaction document
   * @param {Array} [rules] - Optional pre-fetched rules (avoids redundant DB call in batch)
   */
  async _processTransaction(tx, rules) {
    const startTime = Date.now();

    try {
      if (!rules) {
        rules = await this._getActiveRules();
      }

      // Find first matching rule (by priority)
      const matchedRule = this._evaluateRules(tx, rules);

      if (!matchedRule) {
        await BankLogTransaction.updateOne(
          { _id: tx._id },
          {
            $set: {
              status: BANK_LOG_TX_STATUSES.NO_ROUTE,
              processingDurationMs: Date.now() - startTime,
            },
          },
        );
        logger.info('Bank Log: No matching rule', { txId: tx.txId });
        return;
      }

      // Check circuit breaker
      if (this._isCircuitOpen(matchedRule.targetApi.url)) {
        await BankLogTransaction.updateOne(
          { _id: tx._id },
          {
            $set: {
              status: BANK_LOG_TX_STATUSES.FAILED,
              matchedRuleName: matchedRule.name,
              matchedRuleId: matchedRule.id,
              targetApiUrl: matchedRule.targetApi.url,
              apiResponseBody: { error: 'Circuit breaker OPEN — target API temporarily unavailable' },
              processingDurationMs: Date.now() - startTime,
            },
          },
        );
        return;
      }

      // Forward to target API
      const result = await this._forwardToApi(tx, matchedRule);

      await BankLogTransaction.updateOne(
        { _id: tx._id },
        {
          $set: {
            status: result.success
              ? BANK_LOG_TX_STATUSES.SUCCESS
              : BANK_LOG_TX_STATUSES.FAILED,
            matchedRuleName: matchedRule.name,
            matchedRuleId: matchedRule.id,
            targetApiUrl: matchedRule.targetApi.url,
            apiResponseCode: result.statusCode,
            apiResponseBody: result.body,
            processingDurationMs: Date.now() - startTime,
          },
        },
      );
    } catch (err) {
      logger.error('Bank Log: Processing error', {
        txId: tx.txId,
        error: err.message,
      });

      await BankLogTransaction.updateOne(
        { _id: tx._id },
        {
          $set: {
            status: BANK_LOG_TX_STATUSES.FAILED,
            apiResponseBody: { error: err.message },
            processingDurationMs: Date.now() - startTime,
          },
        },
      ).catch(() => {});
    }
  }

  async _getActiveRules() {
    const cached = await CacheService.get(RULES_CACHE_KEY);
    if (cached) return cached;

    const rules = await BankLogRoutingRule.find({ isActive: true })
      .sort({ priority: 1 })
      .lean();

    await CacheService.set(RULES_CACHE_KEY, rules, RULES_CACHE_TTL);
    return rules;
  }

  _evaluateRules(tx, rules) {
    for (const rule of rules) {
      const allMatch = rule.conditions.every((cond) =>
        this._checkCondition(tx, cond),
      );
      if (allMatch) return rule;
    }
    return null;
  }

  _checkCondition(tx, condition) {
    const { parameter, operator, value } = condition;
    const txValue = tx[parameter];

    if (txValue == null) return false;

    switch (operator) {
      // Numeric operators
      case 'greater_than':
        return Number(txValue) > Number(value);
      case 'less_than':
        return Number(txValue) < Number(value);
      case 'equal':
        return String(txValue).toLowerCase() === value.toLowerCase();

      // String operators
      case 'contains':
        return String(txValue).toLowerCase().includes(value.toLowerCase());
      case 'starts_with':
        return String(txValue).toLowerCase().startsWith(value.toLowerCase());
      case 'ends_with':
        return String(txValue).toLowerCase().endsWith(value.toLowerCase());
      case 'regex':
        try {
          return new RegExp(value, 'i').test(String(txValue));
        } catch {
          return false;
        }

      default:
        return false;
    }
  }

  _buildRequestHeaders(targetApi) {
    const headers = { 'Content-Type': 'application/json' };

    switch (targetApi.authType) {
      case BANK_LOG_AUTH_TYPES.BEARER:
        if (targetApi.authToken) {
          headers['Authorization'] = `Bearer ${targetApi.authToken}`;
        }
        break;
      case BANK_LOG_AUTH_TYPES.API_KEY:
        if (targetApi.authToken) {
          headers['X-API-Key'] = targetApi.authToken;
        }
        break;
      case BANK_LOG_AUTH_TYPES.BASIC:
        if (targetApi.authToken) {
          headers['Authorization'] = `Basic ${targetApi.authToken}`;
        }
        break;
    }

    // Custom headers (override if same key)
    if (targetApi.headers) {
      const customHeaders =
        targetApi.headers instanceof Map
          ? Object.fromEntries(targetApi.headers)
          : targetApi.headers;

      for (const [key, val] of Object.entries(customHeaders)) {
        if (key && val) headers[key] = val;
      }
    }

    return headers;
  }

  async _forwardToApi(tx, rule) {
    const { targetApi } = rule;
    const timeout = (targetApi.timeout || 10) * 1000;
    const headers = this._buildRequestHeaders(targetApi);

    const payload = {
      txId: tx.txId,
      bank: tx.bank,
      sender: tx.sender,
      amount: tx.amount,
      content: tx.content,
      transactionDate: tx.transactionDate,
    };

    try {
      const method = (targetApi.method || 'POST').toLowerCase();
      const response = await httpClient.instance({
        method,
        url: targetApi.url,
        data: payload,
        headers,
        timeout,
      });

      this._recordSuccess(targetApi.url);

      return {
        success: true,
        statusCode: response.status || 200,
        body: response.data || response,
      };
    } catch (err) {
      this._recordFailure(targetApi.url);

      return {
        success: false,
        statusCode: err.response?.status || 0,
        body: err.response?.data || { error: err.message },
      };
    }
  }

  // ─── Circuit Breaker ──────────────────────────────────────────────────────

  _isCircuitOpen(url) {
    const cb = this._circuitBreakers.get(url);
    if (!cb || cb.failures < 5) return false;
    // Half-open after 30s
    if (Date.now() - cb.lastFailure > 30000) return false;
    return true;
  }

  _recordSuccess(url) {
    this._circuitBreakers.delete(url);
  }

  _recordFailure(url) {
    const cb = this._circuitBreakers.get(url) || { failures: 0, lastFailure: 0 };
    cb.failures += 1;
    cb.lastFailure = Date.now();
    this._circuitBreakers.set(url, cb);

    if (cb.failures >= 5) {
      logger.warn('Bank Log: Circuit breaker OPEN', { url, failures: cb.failures });
    }
  }
}

module.exports = new BankLogService();
