const PLATFORMS = ["SmaxAi", "Botvn", "Appvn"];
const CUSTOMER_GROUPS = ["Mới", "Tiềm năng", "Thân thiết", "Rời bỏ", "VIP"];
const CUSTOMER_TYPES = [
  "Standard Customer",
  "VIP Customer",
  "Partner",
  "Regular",
  "Premium",
];
const USER_ROLE_VALUES = Object.freeze({
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  STAFF: "STAFF",
});

const USER_ROLES = [
  { value: USER_ROLE_VALUES.OWNER, label: "Owner" },
  { value: USER_ROLE_VALUES.ADMIN, label: "Admin" },
  { value: USER_ROLE_VALUES.MANAGER, label: "Manager (Trưởng phòng)" },
  { value: USER_ROLE_VALUES.STAFF, label: "Staff (Nhân viên)" },
];

const DEFAULT_USER_ROLE = USER_ROLE_VALUES.STAFF;

module.exports = {
  PLATFORMS,
  CUSTOMER_GROUPS,
  CUSTOMER_TYPES,
  DEFAULT_USER_ROLE,
  USER_ROLES,
  USER_ROLE_VALUES,
};
