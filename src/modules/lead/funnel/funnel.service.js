const FunnelFolder = require('./funnelFolder.model');
const FunnelGroup = require('./funnelGroup.model');
const Funnel = require('./funnel.model');
const ActionChain = require('../../event/eventActionChain/actionChain.model');
const LeadStatusGroup = require('../leadConfig/leadStatusGroup.model');
const LeadStatus = require('../leadConfig/leadStatus.model');
const Lead = require('../lead/lead.model');
const {
  generateMonotonicId,
  generateMonotonicIdsBatch,
  ID_PREFIXES,
} = require('../../../core/utils/id');
const { createHttpError } = require('../../../core/utils/http');
const {
  isSystemEntity,
  SYSTEM_IDS,
} = require('../../../core/constants/systemFunnel');
const CacheService = require('../../../core/services/CacheService');
const { CACHE_TTL } = require('../../../core/constants/cache');
const { computeChanges } = require('../../../core/utils/diff');

class FunnelService {
  /**
   * Clone a template LeadStatusGroup + its LeadStatuses for a specific Funnel.
   * Only used at Funnel level — Folder/Group store defaultStatusGroupId as a hint only.
   */
  async _cloneStatusGroupForFunnel(
    statusGroupId,
    funnelId,
    customStatusOrder = null,
  ) {
    if (!statusGroupId) return null;
    const templateGroup = await LeadStatusGroup.findOne({
      id: statusGroupId,
    }).lean();
    if (!templateGroup)
      throw createHttpError(404, 'Không tìm thấy nhóm trạng thái');

    const templateStatuses = await LeadStatus.find({
      id: { $in: templateGroup.statusIds },
    }).lean();

    const newStatusIds = await generateMonotonicIdsBatch(
      ID_PREFIXES.LEAD_STATUS,
      templateStatuses.length,
    );
    const idMap = {};
    const clonedStatuses = templateStatuses.map((st, index) => {
      const cloned = {
        ...st,
        _id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      };
      cloned.id = newStatusIds[index];
      cloned.isTemplate = false;
      cloned.funnelId = funnelId;
      idMap[st.id] = cloned.id;
      return cloned;
    });

    if (clonedStatuses.length > 0) {
      await LeadStatus.insertMany(clonedStatuses);
    }

    let finalStatusIds = templateGroup.statusIds.map((id) => idMap[id]);
    if (
      customStatusOrder &&
      Array.isArray(customStatusOrder) &&
      customStatusOrder.length > 0
    ) {
      const ordered = customStatusOrder
        .filter((id) => idMap[id])
        .map((id) => idMap[id]);
      const missing = finalStatusIds.filter((id) => !ordered.includes(id));
      finalStatusIds = [...ordered, ...missing];
    }

    const newGroupId = await generateMonotonicId(ID_PREFIXES.LEAD_STATUS_GROUP);
    const clonedGroup = new LeadStatusGroup({
      ...templateGroup,
      _id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      id: newGroupId,
      isTemplate: false,
      funnelId: funnelId,
      statusIds: finalStatusIds,
    });
    await clonedGroup.save();

    return newGroupId;
  }

  /**
   * Delete a cloned (non-template) status group and its statuses.
   * Used only when changing/deleting a Funnel's status group.
   */
  async _deleteClonedStatusGroup(statusGroupId) {
    if (!statusGroupId) return;
    const oldGroup = await LeadStatusGroup.findOne({ id: statusGroupId });
    if (oldGroup && oldGroup.isTemplate === false) {
      await LeadStatusGroup.findOneAndDelete({ id: statusGroupId });
      await LeadStatus.deleteMany({ id: { $in: oldGroup.statusIds } });
    }
  }

  async _validateActionChains(chainIds) {
    if (!chainIds || chainIds.length === 0) return;
    const existing = await ActionChain.find({
      id: { $in: chainIds },
      active: true,
    })
      .select('id')
      .lean();
    const existingSet = new Set(existing.map((c) => c.id));
    const missing = chainIds.filter((id) => !existingSet.has(id));
    if (missing.length > 0) {
      throw createHttpError(
        400,
        `Chuỗi hành động "${missing.join(', ')}" không tồn tại hoặc đã bị tắt.`,
      );
    }
  }

  // ─── Folder CRUD ───

  async getFolders() {
    return CacheService.withVersionedCache(
      'funnels:folders',
      {},
      CACHE_TTL.LONG,
      async () => {
        return await FunnelFolder.find().sort({ createdAt: 1 }).lean();
      },
      { swr: true, maxTtl: CACHE_TTL.LONG },
    );
  }

  async createFolder(data) {
    const folderId = await generateMonotonicId(ID_PREFIXES.FUNNEL_FOLDER);
    const newFolder = new FunnelFolder({
      id: folderId,
      name: data.name,
      defaultStatusGroupId: data.defaultStatusGroupId || null,
    });
    await newFolder.save();
    await CacheService.bumpNamespaceVersion('funnels:folders');
    await CacheService.bumpNamespaceVersion('metadata');
    return newFolder;
  }

  async updateFolder(id, data) {
    if (isSystemEntity(id))
      throw createHttpError(400, 'Không thể sửa thư mục hệ thống.');
    const folder = await FunnelFolder.findOne({ id });
    if (!folder) throw createHttpError(404, 'Không tìm thấy thư mục');

    const oldState = folder.toObject();
    if (data.name !== undefined) folder.name = data.name;
    if (data.defaultStatusGroupId !== undefined)
      folder.defaultStatusGroupId = data.defaultStatusGroupId;
    await folder.save();

    const newState = folder.toObject();
    const changes = computeChanges(oldState, newState);
    await CacheService.bumpNamespaceVersion('funnels:folders');
    await CacheService.bumpNamespaceVersion('metadata');
    return { folder, changes };
  }

  async deleteFolder(id) {
    if (isSystemEntity(id))
      throw createHttpError(400, 'Không thể xoá thư mục hệ thống.');

    const hasGroups = await FunnelGroup.findOne({ folderId: id });
    if (hasGroups) throw createHttpError(400, 'Thư mục đang chứa nhóm phễu.');

    const hasFunnels = await Funnel.findOne({ folderId: id });
    if (hasFunnels) throw createHttpError(400, 'Thư mục đang chứa phễu.');

    const deleted = await FunnelFolder.findOneAndDelete({ id });
    if (!deleted) throw createHttpError(404, 'Không tìm thấy thư mục');

    await CacheService.bumpNamespaceVersion('funnels:folders');
    await CacheService.bumpNamespaceVersion('metadata');
    return deleted;
  }

  // ─── Group CRUD ───

  async getGroups() {
    return CacheService.withVersionedCache(
      'funnels:groups',
      {},
      CACHE_TTL.LONG,
      async () => {
        return await FunnelGroup.find().sort({ createdAt: 1 }).lean();
      },
      { swr: true, maxTtl: CACHE_TTL.LONG },
    );
  }

  async createGroup(data) {
    const groupId = await generateMonotonicId(ID_PREFIXES.FUNNEL_GROUP);
    const newGroup = new FunnelGroup({
      id: groupId,
      name: data.name,
      folderId: data.folderId,
      defaultStatusGroupId: data.defaultStatusGroupId || null,
    });
    await newGroup.save();
    await CacheService.bumpNamespaceVersion('funnels:groups');
    await CacheService.bumpNamespaceVersion('metadata');
    return newGroup;
  }

  async updateGroup(id, data) {
    if (isSystemEntity(id))
      throw createHttpError(400, 'Không thể sửa nhóm phễu hệ thống.');
    const group = await FunnelGroup.findOne({ id });
    if (!group) throw createHttpError(404, 'Không tìm thấy nhóm phễu');

    const oldState = group.toObject();
    if (data.name !== undefined) group.name = data.name;
    if (data.folderId !== undefined) group.folderId = data.folderId;
    if (data.defaultStatusGroupId !== undefined)
      group.defaultStatusGroupId = data.defaultStatusGroupId;
    await group.save();

    const newState = group.toObject();
    const changes = computeChanges(oldState, newState);
    await CacheService.bumpNamespaceVersion('funnels:groups');
    await CacheService.bumpNamespaceVersion('metadata');
    return { group, changes };
  }

  async deleteGroup(id) {
    if (isSystemEntity(id))
      throw createHttpError(400, 'Không thể xoá nhóm phễu hệ thống.');

    const hasFunnels = await Funnel.findOne({ groupId: id });
    if (hasFunnels) throw createHttpError(400, 'Nhóm phễu đang chứa phễu.');

    const deleted = await FunnelGroup.findOneAndDelete({ id });
    if (!deleted) throw createHttpError(404, 'Không tìm thấy nhóm phễu');

    await CacheService.bumpNamespaceVersion('funnels:groups');
    await CacheService.bumpNamespaceVersion('metadata');
    return deleted;
  }

  // ─── Funnel CRUD ───

  async getFunnels() {
    return CacheService.withVersionedCache(
      'funnels:funnels',
      {},
      CACHE_TTL.LONG,
      async () => {
        return await Funnel.find().sort({ createdAt: 1 }).lean();
      },
      { swr: true, maxTtl: CACHE_TTL.LONG },
    );
  }

  async _prepareFunnelPayload(data) {
    const cleaned = { ...data };
    if (!cleaned.groupId || cleaned.groupId === '') cleaned.groupId = null;
    if (!cleaned.folderId || cleaned.folderId === '') cleaned.folderId = null;

    if (cleaned.groupId && cleaned.folderId) {
      throw createHttpError(
        400,
        'Phễu không thể vừa thuộc thư mục vừa thuộc nhóm phễu.',
      );
    }
    if (!cleaned.groupId && !cleaned.folderId) {
      throw createHttpError(400, 'Phễu phải thuộc thư mục hoặc nhóm phễu.');
    }

    // Chuẩn hóa Action Chains
    const rawChainIds =
      cleaned.autoCreateChain && Array.isArray(cleaned.actionChainIds)
        ? cleaned.actionChainIds
        : [];

    cleaned.actionChainIds = [...new Set(rawChainIds.filter(Boolean))];

    if (cleaned.actionChainIds.length > 0) {
      await this._validateActionChains(cleaned.actionChainIds);
    }

    return cleaned;
  }

  async createFunnel(data) {
    const cleaned = await this._prepareFunnelPayload(data);
    const funnelId = await generateMonotonicId(ID_PREFIXES.FUNNEL);

    if (cleaned.statusGroupId) {
      cleaned.statusGroupId = await this._cloneStatusGroupForFunnel(
        cleaned.statusGroupId,
        funnelId,
        cleaned.customStatusOrder,
      );
    }

    const newFunnel = new Funnel({
      ...cleaned,
      id: funnelId,
    });
    await newFunnel.save();
    await CacheService.bumpNamespaceVersion('funnels:funnels');
    await CacheService.bumpNamespaceVersion('lead_configs:groups');
    await CacheService.bumpNamespaceVersion('lead_configs:statuses');
    await CacheService.bumpNamespaceVersion('metadata');
    return newFunnel;
  }

  async updateFunnel(id, data) {
    if (isSystemEntity(id))
      throw createHttpError(400, 'Không thể sửa phễu hệ thống.');

    const cleaned = await this._prepareFunnelPayload(data);

    const funnel = await Funnel.findOne({ id });
    if (!funnel) throw createHttpError(404, 'Không tìm thấy phễu');

    if (
      cleaned.statusGroupId &&
      cleaned.statusGroupId !== funnel.statusGroupId
    ) {
      const hasLeads = await Lead.exists({ funnelId: id });
      if (hasLeads) {
        throw createHttpError(
          400,
          'Không thể đổi nhóm trạng thái vì phễu này đã có khách hàng.',
        );
      }

      const newGroupId = await this._cloneStatusGroupForFunnel(
        cleaned.statusGroupId,
        id,
        cleaned.customStatusOrder,
      );

      // Delete old cloned status group
      await this._deleteClonedStatusGroup(funnel.statusGroupId);

      cleaned.statusGroupId = newGroupId;
      await CacheService.bumpNamespaceVersion('lead_configs:groups');
      await CacheService.bumpNamespaceVersion('lead_configs:statuses');
    } else if (
      cleaned.statusGroupId &&
      cleaned.statusGroupId === funnel.statusGroupId &&
      cleaned.customStatusOrder &&
      Array.isArray(cleaned.customStatusOrder)
    ) {
      // Reorder existing cloned group
      const existingGroup = await LeadStatusGroup.findOne({
        id: funnel.statusGroupId,
      });
      if (existingGroup && existingGroup.isTemplate === false) {
        const idMap = {};
        existingGroup.statusIds.forEach((stId) => {
          idMap[stId] = stId;
        });
        const ordered = cleaned.customStatusOrder.filter((stId) => idMap[stId]);
        const missing = existingGroup.statusIds.filter(
          (stId) => !ordered.includes(stId),
        );
        existingGroup.statusIds = [...ordered, ...missing];
        await existingGroup.save();
        await CacheService.bumpNamespaceVersion('lead_configs:groups');
        await CacheService.bumpNamespaceVersion('lead_configs:statuses');
      }
    }

    const oldState = funnel.toObject();
    Object.assign(funnel, cleaned);
    await funnel.save();
    const newState = funnel.toObject();
    const changes = computeChanges(oldState, newState);
    await CacheService.bumpNamespaceVersion('funnels:funnels');
    await CacheService.bumpNamespaceVersion('metadata');
    return { funnel, changes };
  }

  async deleteFunnel(id) {
    if (isSystemEntity(id))
      throw createHttpError(400, 'Không thể xoá phễu hệ thống.');

    const hasLeads = await Lead.exists({ funnelId: id });
    if (hasLeads) {
      throw createHttpError(
        400,
        'Không thể xoá phễu vì phễu này đang có khách hàng.',
      );
    }

    const deleted = await Funnel.findOneAndDelete({ id });
    if (!deleted) throw createHttpError(404, 'Không tìm thấy phễu');

    // Clean up cloned statuses
    await this._deleteClonedStatusGroup(deleted.statusGroupId);

    await CacheService.bumpNamespaceVersion('funnels:funnels');
    await CacheService.bumpNamespaceVersion('lead_configs:groups');
    await CacheService.bumpNamespaceVersion('lead_configs:statuses');
    await CacheService.bumpNamespaceVersion('metadata');
    return deleted;
  }
}

module.exports = new FunnelService();
