const Customer = require("../models/Customer");
const Event = require("../models/Event");
const { generateMonotonicId, ID_PREFIXES } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");
const { resolvePagination, buildPaginatedResponse, resolveSort } = require("../utils/pagination");
const { createHttpError } = require("../utils/http");
const { getUserRoleName } = require("../utils/rbac");
const { computeChanges } = require("../utils/diff");
const {
  BIZ_SUB_TYPE_LIST,
  USER_SUB_TYPE_LIST,
  CUSTOMER_MAIN_TYPES,
} = require("../constants/appData");
const CacheService = require("./CacheService");
const { CACHE_TTL } = require("../constants/cache");

class CustomerService {
  async getCustomers(queryParams, currentUser) {
    const { search = "", type, group, platform, includeDeleted, mainType, subType } = queryParams;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(queryParams || {});

    return CacheService.withVersionedCache("customers", { q: queryParams, role: (await getUserRoleName(currentUser) || "").toUpperCase() }, CACHE_TTL.SHORT, async () => {
      const query = {};

      if (searchRegex) {
        query.$or = [
          { id: searchRegex },
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ];
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
      const canSeeDeleted = ["OWNER", "ADMIN"].includes(roleName) && includeDeleted === "true";

      let customers, totalItems;

      const sortObj = resolveSort(queryParams, ["createdAt", "name", "updatedAt", "email", "type"]);

      if (canSeeDeleted) {
        [customers, totalItems] = await Promise.all([
          Customer.findWithDeleted(query).sort(sortObj).skip(skip).limit(limit).lean(),
          Customer.countWithDeleted(query),
        ]);
      } else {
        [customers, totalItems] = await Promise.all([
          Customer.find(query).sort(sortObj).skip(skip).limit(limit).lean(),
          Customer.countDocuments(query),
        ]);
      }

      return buildPaginatedResponse(customers, totalItems, page, limit);
    });
  }

  async getCustomerById(id) {
    const customer = await Customer.findOne({ id });
    if (!customer) {
      throw createHttpError(404, "Customer not found", { code: "CUSTOMER_NOT_FOUND" });
    }
    return customer;
  }

  async createCustomer(payload) {
    // Check if customer already exists
    const existingCustomer = await Customer.findOneWithDeleted({ email: payload.email }).lean();
    if (existingCustomer) {
      if (existingCustomer.isDeleted) {
        throw createHttpError(409, "Khách hàng đã bị xóa, không thể thêm mới. Vui lòng liên hệ admin để được hỗ trợ khôi phục khách hàng.", { code: "CUSTOMER_HAS_BEEN_DELETED" });
      }
      throw createHttpError(409, "Khách hàng đã tồn tại, không thể thêm mới. Vui lòng kiểm tra lại thông tin.", { code: "CUSTOMER_ALREADY_EXISTS" });
    }

    const customer = await Customer.create({
      id: await generateMonotonicId(ID_PREFIXES.CUSTOMER),
      name: payload.name,
      avatar:
        payload.avatar ||
        `https://i.pravatar.cc/150?u=${encodeURIComponent(payload.email)}`,
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
        payload.registeredAt || new Date().toLocaleDateString("vi-VN"),
      lastLoginAt:
        payload.lastLoginAt || new Date().toLocaleDateString("vi-VN"),
      tags: Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : [],
      extraInfo: payload.extraInfo || null,
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
      if (!["OWNER", "ADMIN"].includes(roleName)) {
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
    });

    await existing.save();

    const newState = existing.toObject();
    const keysToCheck = ["name", "avatar", "mainType", "subType", "alias", "type", "email", "phone", "biz", "platforms", "group", "registeredAt", "tags", "extraInfo", "isActive"];
    const changes = computeChanges(oldState, newState, keysToCheck);

    await CacheService.bumpNamespaceVersion("customers");
    return { customer: existing, changes };
  }

  async deleteCustomer(id, currentUserId, { force = false } = {}) {
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
