const ProjectBonus = require('./projectBonus.model');

const getAllProjectBonuses = async () => {
  return await ProjectBonus.find().sort({ createdAt: -1 });
};

const getProjectBonusById = async (id) => {
  return await ProjectBonus.findById(id);
};

const createProjectBonus = async (data) => {
  const projectBonus = new ProjectBonus(data);
  return await projectBonus.save();
};

const updateProjectBonus = async (id, updateData) => {
  return await ProjectBonus.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true },
  );
};

const deleteProjectBonus = async (id) => {
  return await ProjectBonus.findByIdAndDelete(id);
};

module.exports = {
  getAllProjectBonuses,
  getProjectBonusById,
  createProjectBonus,
  updateProjectBonus,
  deleteProjectBonus,
};
