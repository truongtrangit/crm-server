const ProjectBonus = require('./projectBonus.model');
const User = require('../../system/user/user.model');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');

const getAllProjectBonuses = async () => {
  const bonuses = await ProjectBonus.find()
    .sort({ createdAt: -1 })
    .populate('creator', 'name')
    .lean({ virtuals: true });
  
  return bonuses.map(bonus => ({
    ...bonus,
    createdBy: bonus.creator ? bonus.creator.name : bonus.createdBy,
  }));
};

const getProjectBonusById = async (id) => {
  return await ProjectBonus.findOne({ id });
};

const createProjectBonus = async (data) => {
  const customId = await generateMonotonicId(ID_PREFIXES.PROJECT_BONUS);
  const projectBonus = new ProjectBonus({
    ...data,
    id: customId,
  });
  return await projectBonus.save();
};

const updateProjectBonus = async (id, updateData) => {
  return await ProjectBonus.findOneAndUpdate(
    { id },
    { $set: updateData },
    { new: true, runValidators: true },
  );
};

const deleteProjectBonus = async (id) => {
  return await ProjectBonus.findOneAndDelete({ id });
};

module.exports = {
  getAllProjectBonuses,
  getProjectBonusById,
  createProjectBonus,
  updateProjectBonus,
  deleteProjectBonus,
};
