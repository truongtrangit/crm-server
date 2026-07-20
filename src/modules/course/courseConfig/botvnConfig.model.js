const mongoose = require('mongoose');
const { BOTVN_ROLES } = require('../../../core/constants/appData');

const BOTVN_MAINTENANCE_TYPES = {
  MAINTENANCE: 'maintenance',
  COMING_SOON: 'coming_soon',
};

const botvnConfigSchema = new mongoose.Schema(
  {
    menus: {
      home: { type: Boolean, default: true },
      online: { type: Boolean, default: true },
      offline: { type: Boolean, default: true },
      challenge: { type: Boolean, default: true },
      nextMarketer: { type: Boolean, default: true },
      knowledge: { type: Boolean, default: true },
    },
    login: {
      emailPassword: { type: Boolean, default: true },
      facebook: { type: Boolean, default: true },
      google: { type: Boolean, default: true },
      qrCode: { type: Boolean, default: true },
      allowRegistration: { type: Boolean, default: true },
    },
    maintenance: {
      isActive: { type: Boolean, default: false },
      type: {
        type: String,
        enum: Object.values(BOTVN_MAINTENANCE_TYPES),
        default: BOTVN_MAINTENANCE_TYPES.MAINTENANCE,
      },
      title: { type: String, default: '' },
      reason: { type: String, default: '' },
      time: { type: String, default: '' },
      allowedRoles: [{
        type: String,
        enum: Object.values(BOTVN_ROLES)
      }]
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('BotvnConfig', botvnConfigSchema);
module.exports.BOTVN_MAINTENANCE_TYPES = BOTVN_MAINTENANCE_TYPES;
