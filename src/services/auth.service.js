const jwt = require('jsonwebtoken');
const httpStatus = require('http-status');

const { env } = require('../config');
const ApiError = require('../utils/ApiError');
const userService = require('./user.service');
const { userMessage, authMessage } = require('../messages');
const { URL_HOST, TOKEN_TYPES, EMAIL_TYPES, EMAIL_SUBJECT, EXPIRES_TOKEN_EMAIL_VERIFY } = require('../constants');
const emailService = require('./email.service');
const cryptoService = require('./crypto.service');

const login = async (email, password) => {
  const user = await userService.getUserByEmail(email);
  if (!user || !(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, authMessage().INVALID_LOGIN);
  }

  if (!user.isVerify) {
    throw new ApiError(httpStatus.UNAUTHORIZED, authMessage().PLEASE_VERIFY_EMAIL);
  }

  if (user.isLocked) {
    throw new ApiError(httpStatus.UNAUTHORIZED, userMessage().USER_LOCKED);
  }

  const payload = { id: user.id, email, role: user.role };

  user.lastActive = Date.now();
  await user.save();
  user.password = undefined;

  const accessToken = generateToken(TOKEN_TYPES.ACCESS, payload);
  const refreshToken = generateToken(TOKEN_TYPES.REFRESH, payload);

  return { user, accessToken, refreshToken };
};

const register = async (username, email, password) => {
  const expires = Date.now() + EXPIRES_TOKEN_EMAIL_VERIFY;

  const registerData = {
    username,
    email,
    password,
    verifyExpireAt: expires,
  };

  await userService.createUser(registerData);

  const tokenVerify = cryptoService.encryptObj(
    {
      email,
      expires,
      type: TOKEN_TYPES.VERIFY,
    },
    env.secret.tokenVerify,
  );
  const linkVerify = `${URL_HOST[env.NODE_ENV]}/api/v1/auth/verify?token=${tokenVerify}`;
  await emailService.sendEmail({
    emailData: {
      emails: email,
      subject: EMAIL_SUBJECT.VERIFY,
      linkVerify,
    },
    type: EMAIL_TYPES.VERIFY,
  });
};

const refreshToken = async (refreshToken) => {
  const payload = jwt.verify(refreshToken, env.jwt.secretRefresh);

  if (!payload || payload.type !== TOKEN_TYPES.REFRESH) {
    throw new ApiError(httpStatus.BAD_REQUEST, authMessage().INVALID_TOKEN);
  }

  const user = await userService.getUserByEmail(payload.email);
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, authMessage().INVALID_TOKEN);
  }

  if (user.isLocked) {
    throw new ApiError(httpStatus.UNAUTHORIZED, userMessage().USER_LOCKED);
  }

  data = { id: user.id, email: user.email };
  const accessToken = generateToken(TOKEN_TYPES.ACCESS, data);

  return { accessToken };
};

const generateToken = (type, payload) => {
  const secret = type === TOKEN_TYPES.ACCESS ? env.jwt.secretAccess : env.jwt.secretRefresh;

  const expiresIn = type === TOKEN_TYPES.ACCESS ? env.jwt.expiresAccessToken : env.jwt.expiresRefreshToken;

  const token = jwt.sign({ ...payload, type }, secret, {
    expiresIn,
  });

  return token;
};

const changePassword = async (userId, oldPassword, newPassword) => {
  const user = await userService.getUserById(userId);

  if (!(await user.isPasswordMatch(oldPassword))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, authMessage().INVALID_PASSWORD);
  }

  user.password = newPassword;
  await user.save();
  user.password = undefined;

  return user;
};

const verifyEmail = async (token) => {
  const { isExpired, payload } = cryptoService.expiresCheck(token, env.secret.tokenVerify);

  if (isExpired) {
    throw new ApiError(httpStatus.BAD_REQUEST, authMessage().INVALID_TOKEN_VERIFY_EXPIRED);
  }

  const user = await userService.getUserByEmail(payload.email);

  if (!user || user?.isVerify) {
    throw new ApiError(httpStatus.BAD_REQUEST, authMessage().INVALID_TOKEN);
  }

  user.isVerify = true;
  user.verifyExpireAt = null;
  await user.save();
  user.password = undefined;

  return user;
};

module.exports = {
  login,
  register,
  refreshToken,
  changePassword,
  verifyEmail,
};
