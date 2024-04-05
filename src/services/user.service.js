const { User } = require('../models');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const { userMessage } = require('../messages');
const SearchFeature = require('../utils/SearchFeature');

const getUserByEmail = async (email) => {
  const user = await User.findOne({ email }).select('+password');
  return user;
};

const getUserById = async (id) => {
  const user = await User.findById(id).select('+password');
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, userMessage().NOT_FOUND);
  }
  return user;
};

const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, userMessage().EXISTS_EMAIL);
  }
  const user = await User.create(userBody);
  user.password = undefined;
  return user;
};

const getUsersByKeyword = async (requestQuery) => {
  const searchFeatures = new SearchFeature(User);
  const { results, ...detailResult } = await searchFeatures.getResults(requestQuery, ['fullname', 'email', 'phone']);
  return { users: results, ...detailResult };
};

const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId);
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, userMessage().EXISTS_EMAIL);
  }
  Object.assign(user, updateBody);
  await user.save();
  user.password = undefined;
  return user;
};

const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  await user.deleteOne();
  return user;
};

module.exports = {
  getUserByEmail,
  createUser,
  getUserById,
  getUsersByKeyword,
  updateUserById,
  deleteUserById,
};