const Customer = require('./customer.model');
const Event = require('../../event/event/event.model');
const Subscription = require('../../hr/company/subscription.model');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const { buildSearchRegex } = require('../../../core/utils/query');
const { resolvePagination, buildPaginatedResponse, resolveSort } = require('../../../core/utils/pagination');
const { createHttpError } = require('../../../core/utils/http');
const { getUserRoleName } = require('../../../core/utils/rbac');
const { computeChanges } = require('../../../core/utils/diff');
const {
  BIZ_SUB_TYPE_LIST,
  USER_SUB_TYPE_LIST,
  CUSTOMER_MAIN_TYPES,
} = require('../../../core/constants/appData');
const { getDefaultAvatar } = require('../../../core/utils/avatar');
const { isOwnerOrAdmin } = require('../../../core/utils/userRoles');
const CacheService = require('../../../core/services/CacheService');
const { CACHE_TTL } = require('../../../core/constants/cache');
const { hashPassword } = require('../../../core/utils/auth');

class CustomerService {
  async getCustomers(queryParams, currentUser, scopeFilter = {}) {
    const { search = "", type, group, platform, mainType, subType } = queryParams;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(queryParams || {});

    return CacheService.withVersionedCache("customers", { q: queryParams, role: (await getUserRoleName(currentUser) || "").toUpperCase() }, CACHE_TTL.SHORT, async () => {
      const query = {};
      const andClauses = [];

      if (scopeFilter && Object.keys(scopeFilter).length > 0) {
        andClauses.push(scopeFilter);
      }

      if (searchRegex) {
        andClauses.push({
          $or: [
            { id: searchRegex },
            { name: searchRegex },
            { email: searchRegex },
            { phone: searchRegex },
          ]
        });
      }

      if (andClauses.length > 0) {
        query.$and = andClauses;
      }

      if (type && type !== "All") {
        query.type = type;
      }

      if (mainType && mainType !== "all") {
        query.mainType = mainType;
      }

      if (subType && subType !== "all") {
        query.subType = subType;
      }

      if (group) {
        query.group = group;
      }

      if (platform) {
        query.platforms = platform;
      }

      // Owner/Admin can see deleted customers
      const roleName = (await getUserRoleName(currentUser) || "").toUpperCase();
      const canSeeDeleted = isOwnerOrAdmin(roleName) && queryParams.isDeleted === "true";

      const sortObj = resolveSort(queryParams, ["createdAt", "name", "updatedAt", "email", "type"]);

      if (canSeeDeleted) {
        query.isDeleted = true;
      }

      const [customers, totalItems] = await Promise.all([
        Customer.find(query).select('+botvnPassword').sort(sortObj).skip(skip).limit(limit).lean(),
        Customer.countDocuments(query),
      ]);

      // Attach subscriptions and members to BIZ customers
      const bizCustomerIds = customers.filter(c => c.mainType === CUSTOMER_MAIN_TYPES.BIZ).map(c => c.id);
      if (bizCustomerIds.length > 0) {
        const [subscriptions, members] = await Promise.all([
          Subscription.find({ customerId: { $in: bizCustomerIds } }).sort({ endDate: -1 }).lean(),
          Customer.find({
            mainType: CUSTOMER_MAIN_TYPES.USER,
            'bizDetails.bizId': { $in: bizCustomerIds }
          }).lean()
        ]);

        // Map subscriptions by customerId (keep newest)
        const subMap = {};
        for (const sub of subscriptions) {
          if (!subMap[sub.customerId]) {
            subMap[sub.customerId] = sub;
          }
        }

        // Map members by bizId
        const membersMap = {};
        for (const member of members) {
          if (member.bizDetails && Array.isArray(member.bizDetails)) {
            for (const bizD of member.bizDetails) {
              if (bizCustomerIds.includes(bizD.bizId)) {
                if (!membersMap[bizD.bizId]) {
                  membersMap[bizD.bizId] = [];
                }
                membersMap[bizD.bizId].push({
                  id: member.id,
                  name: member.name,
                  avatar: member.avatar,
                  email: member.email,
                  phone: member.phone,
                  role: bizD.role || ""
                });
              }
            }
          }
        }
        // Attach to customers
        for (const c of customers) {
          if (c.mainType === CUSTOMER_MAIN_TYPES.BIZ) {
            c.subscription = subMap[c.id] || null;
            c.members = membersMap[c.id] || [];
          }
          c.hasBotvnPassword = !!c.botvnPassword;
          delete c.botvnPassword;
        }
      } else {
        // If no BIZ customers, still need to process hasBotvnPassword
        for (const c of customers) {
          c.hasBotvnPassword = !!c.botvnPassword;
          delete c.botvnPassword;
        }
      }

      return buildPaginatedResponse(customers, totalItems, page, limit);
    });
  }

  async getCustomerById(id) {
    const customer = await Customer.findOne({ id }).select('+botvnPassword');
    if (!customer) {
      throw createHttpError(404, "Customer not found", { code: "CUSTOMER_NOT_FOUND" });
    }
    const customerObj = customer.toObject();
    customerObj.hasBotvnPassword = !!customerObj.botvnPassword;
    delete customerObj.botvnPassword;
    if (customerObj.mainType === CUSTOMER_MAIN_TYPES.BIZ) {
      const [subscription, members] = await Promise.all([
        Subscription.findOne({ customerId: id }).sort({ endDate: -1 }).lean(),
        Customer.find({
          mainType: CUSTOMER_MAIN_TYPES.USER,
          'bizDetails.bizId': id
        }).lean()
      ]);

      customerObj.subscription = subscription || null;
      customerObj.members = members.map(member => {
        const bizD = member.bizDetails?.find(b => b.bizId === id);
        return {
          id: member.id,
          name: member.name,
          avatar: member.avatar,
          email: member.email,
          phone: member.phone,
          role: bizD?.role || ""
        };
      });
    }
    return customerObj;
  }

  async createCustomer(payload, currentUser) {
    // Check if customer already exists
    const existingCustomer = await Customer.findOneWithDeleted({ email: payload.email, mainType: payload.mainType || CUSTOMER_MAIN_TYPES.USER }).lean();
    if (existingCustomer) {
      if (existingCustomer.isDeleted) {
        throw createHttpError(409, "Khách hàng đã bị xóa, không thể thêm mới. Vui lòng liên hệ admin để được hỗ trợ khôi phục khách hàng.", { code: "CUSTOMER_HAS_BEEN_DELETED" });
      }
      throw createHttpError(409, "Khách hàng đã tồn tại, không thể thêm mới. Vui lòng kiểm tra lại thông tin.", { code: "CUSTOMER_ALREADY_EXISTS" });
    }

    if (payload.botvnRole) {
      const platforms = Array.isArray(payload.platforms) ? payload.platforms : [];
      if (!platforms.includes("Botvn")) {
        throw createHttpError(400, "Chỉ user thuộc nền tảng Botvn mới được cấu hình role này", { code: "INVALID_BOTVN_ROLE" });
      }
    }

    const customer = await Customer.create({
      id: await generateMonotonicId(ID_PREFIXES.CUSTOMER),
      name: payload.name,
      avatar:
        payload.avatar ||
        getDefaultAvatar(payload.name || payload.email),
      mainType: payload.mainType || CUSTOMER_MAIN_TYPES.USER,
      subType: payload.subType || "",
      alias: payload.alias || "",
      type: payload.type || "Standard Customer",
      email: payload.email,
      phone: payload.phone || "",
      biz: (payload.mainType || CUSTOMER_MAIN_TYPES.USER) === CUSTOMER_MAIN_TYPES.BIZ
        ? []
        : (Array.isArray(payload.biz) ? payload.biz.filter(Boolean) : []),
      platforms: Array.isArray(payload.platforms)
        ? payload.platforms.filter(Boolean)
        : [],
      group: payload.group || "",
      registeredAt:
        payload.registeredAt || new Date().toLocaleDateString("vi-VN", { timeZone: 'Asia/Ho_Chi_Minh' }),
      lastLoginAt:
        payload.lastLoginAt || new Date().toLocaleDateString("vi-VN", { timeZone: 'Asia/Ho_Chi_Minh' }),
      tags: Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : [],
      extraInfo: payload.extraInfo || null,
      createdBy: currentUser ? currentUser.id : null,
      ...(payload.botvnPassword && {
        botvnPassword: await hashPassword(payload.botvnPassword),
      }),
      botvnRole: payload.botvnRole || undefined,
      isEduAccount: payload.isEduAccount ?? false,
    });

    await CacheService.bumpNamespaceVersion("customers");
    return customer;
  }

  async updateCustomer(id, payload, currentUser) {
    const existing = await Customer.findOneWithDeleted({ id });
    if (!existing) {
      throw createHttpError(404, "Không tìm thấy khách hàng", { code: "CUSTOMER_NOT_FOUND" });
    }

    if (existing.isDeleted) {
      throw createHttpError(404, "Khách hàng đã bị xóa, không thể cập nhật. Vui lòng liên hệ admin để được hỗ trợ.", { code: "CUSTOMER_IS_DELETED" });
    }

    // Only OWNER/ADMIN may change the subType field
    if (payload.subType !== undefined && payload.subType !== existing.subType) {
      const roleName = (await getUserRoleName(currentUser) || "").toUpperCase();
      if (!isOwnerOrAdmin(roleName)) {
        throw createHttpError(403, "Chỉ Owner hoặc Admin mới có thể thay đổi phân loại này", {
          code: "FORBIDDEN_SUBTYPE_UPDATE",
        });
      }

      // Validate allowed subType values
      if (payload.subType !== "") {
        const isBiz = (payload.mainType || existing.mainType) === CUSTOMER_MAIN_TYPES.BIZ;
        const allowed = isBiz ? BIZ_SUB_TYPE_LIST : USER_SUB_TYPE_LIST;
        if (!allowed.includes(payload.subType)) {
          throw createHttpError(400, `subType không hợp lệ: ${payload.subType}`, {
            code: "INVALID_SUBTYPE",
            allowed,
          });
        }
      }
    }

    if (payload.botvnRole !== undefined) {
      const platforms = Array.isArray(payload.platforms) ? payload.platforms : existing.platforms;
      if (!platforms.includes("Botvn") && payload.botvnRole !== "") {
        throw createHttpError(400, "Chỉ user thuộc nền tảng Botvn mới được cấu hình role này", { code: "INVALID_BOTVN_ROLE" });
      }
    }

    const oldState = existing.toObject();

    Object.assign(existing, {
      name: payload.name ?? existing.name,
      avatar: payload.avatar ?? existing.avatar,
      mainType: payload.mainType ?? existing.mainType,
      subType: payload.subType !== undefined ? payload.subType : existing.subType,
      alias: payload.alias !== undefined ? payload.alias : existing.alias,
      type: payload.type ?? existing.type,
      email: payload.email ?? existing.email,
      phone: payload.phone ?? existing.phone,
      biz: (payload.mainType ?? existing.mainType) === CUSTOMER_MAIN_TYPES.BIZ
        ? []
        : (Array.isArray(payload.biz) ? payload.biz : existing.biz),
      platforms: Array.isArray(payload.platforms)
        ? payload.platforms
        : existing.platforms,
      group: payload.group ?? existing.group,
      registeredAt: payload.registeredAt ?? existing.registeredAt,
      lastLoginAt: payload.lastLoginAt ?? existing.lastLoginAt,
      tags: Array.isArray(payload.tags) ? payload.tags : existing.tags,
      extraInfo: payload.extraInfo !== undefined ? payload.extraInfo : existing.extraInfo,
      isActive: payload.isActive !== undefined ? payload.isActive : existing.isActive,
      botvnRole: payload.botvnRole !== undefined ? (payload.botvnRole || undefined) : existing.botvnRole,
      isEduAccount: payload.isEduAccount !== undefined ? payload.isEduAccount : existing.isEduAccount,
    });

    await existing.save();

    const newState = existing.toObject();
    const keysToCheck = ["name", "avatar", "mainType", "subType", "alias", "type", "email", "phone", "biz", "platforms", "group", "registeredAt", "tags", "extraInfo", "isActive", "isEduAccount"];
    const changes = computeChanges(oldState, newState, keysToCheck);

    await CacheService.bumpNamespaceVersion("customers");
    return { customer: existing, changes };
  }

  async setBotvnPassword(id, password) {
    const customer = await Customer.findOne({ id });
    if (!customer) {
      throw createHttpError(404, "Customer not found", { code: "CUSTOMER_NOT_FOUND" });
    }

    customer.botvnPassword = await hashPassword(password);
    await customer.save();

    return customer;
  }

  async deleteCustomer(id, { force = false } = {}) {
    const customer = await Customer.findOne({ id });
    if (!customer) {
      throw createHttpError(404, "Customer not found", { code: "CUSTOMER_NOT_FOUND" });
    }

    // Referential integrity: check if any Event references this customer
    if (!force) {
      const linkedEvents = await Event.find(
        { customerId: id },
        { id: 1, name: 1 },
      ).lean();
      if (linkedEvents.length > 0) {
        throw createHttpError(
          409,
          `Khách hàng đang liên quan tới ${linkedEvents.length} sự kiện`,
          {
            code: "RESOURCE_IN_USE",
            references: linkedEvents.map((e) => ({
              type: "Event",
              id: e.id,
              name: e.name,
            })),
          },
        );
      }
    } else {
      // Force delete: nullify references in Events
      await Event.updateMany(
        { customerId: id },
        {
          $set: {
            customerId: null,
            "customer.name": "(Đã xóa)",
            "customer.avatar": "",
            "customer.role": "",
            "customer.email": "",
            "customer.phone": "",
            "customer.source": "",
            "customer.address": "",
          },
        },
      );
    }

    await customer.softDelete();
    await CacheService.bumpNamespaceVersion("customers");
    return customer;
  }




  async restoreCustomer(id) {
    const customer = await Customer.findOneWithDeleted({ id });
    if (!customer) {
      throw createHttpError(404, "Customer not found", { code: "CUSTOMER_NOT_FOUND" });
    }
    if (!customer.isDeleted) {
      throw createHttpError(400, "Customer is not deleted", { code: "CUSTOMER_NOT_DELETED" });
    }
    await customer.restore();
    await CacheService.bumpNamespaceVersion("customers");
    return customer;
  }

  /**
   * Xóa vĩnh viễn khách hàng đã bị soft-delete khỏi DB.
   * Chỉ hoạt động trên bản ghi có isDeleted = true.
   */
  async permanentDeleteCustomer(id) {
    const customer = await Customer.findOneWithDeleted({ id });
    if (!customer) {
      throw createHttpError(404, "Customer not found", { code: "CUSTOMER_NOT_FOUND" });
    }
    if (!customer.isDeleted) {
      throw createHttpError(400, "Chỉ có thể xóa vĩnh viễn khách hàng đã bị xóa mềm", {
        code: "CUSTOMER_NOT_SOFT_DELETED",
      });
    }

    // Cascade: nullify references in Events
    await Event.updateMany(
      { customerId: id },
      {
        $set: {
          customerId: null,
          "customer.name": "(Đã xóa)",
          "customer.avatar": "",
          "customer.role": "",
          "customer.email": "",
          "customer.phone": "",
          "customer.source": "",
          "customer.address": "",
        },
      },
    );

    await customer.deleteOne();
    await CacheService.bumpNamespaceVersion("customers");
    return customer;
  }
}

module.exports = new CustomerService();
