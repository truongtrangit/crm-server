const mongoose = require('mongoose');

const salaryRecordSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    month: {
      type: String, // Format: "MM/YYYY", e.g., "05/2026"
      required: true,
    },
    basicSalary: {
      type: Number,
      required: true,
      default: 0,
    },
    bonus: {
      type: Number,
      default: 0,
    },
    allowance: {
      type: Number,
      default: 0,
    },
    actualWorkingDaySalary: {
      type: Number,
      default: null,
    },
    penalty: {
      type: Number,
      default: 0,
    },
    deduction: {
      type: Number,
      default: 0,
    },
    bhxh: {
      type: Number,
      default: 0,
    },
    pit: {
      type: Number,
      default: 0,
    },
    ot: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      default: 0,
    },
    finalReceivedAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

// Ensure a staff member can only have one salary record per month
salaryRecordSchema.index({ staffId: 1, month: 1 }, { unique: true });

const SalaryRecord = mongoose.model('SalaryRecord', salaryRecordSchema);

module.exports = SalaryRecord;
