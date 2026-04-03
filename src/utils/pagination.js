const { createHttpError } = require("./http");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function parsePositiveInteger(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw createHttpError(400, "page and limit must be positive integers", {
      code: "INVALID_PAGINATION",
    });
  }

  return parsedValue;
}

function resolvePagination(query = {}) {
  const page = parsePositiveInteger(query.page, DEFAULT_PAGE);
  const requestedLimit = parsePositiveInteger(query.limit, DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
}

function buildPaginationMeta(totalItems, page, limit) {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: totalPages > 0 && page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
  };
}

function buildPaginatedResponse(items, totalItems, page, limit) {
  return {
    items,
    pagination: buildPaginationMeta(totalItems, page, limit),
  };
}

function paginateArray(items, query = {}) {
  const { page, limit, skip } = resolvePagination(query);
  const totalItems = items.length;
  const paginatedItems = items.slice(skip, skip + limit);

  return buildPaginatedResponse(paginatedItems, totalItems, page, limit);
}

module.exports = {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  buildPaginatedResponse,
  paginateArray,
  resolvePagination,
};
