const crypto = require("crypto");
const { promisify } = require("util");
const env = require("../config/env");

const scryptAsync = promisify(crypto.scrypt);
const REFRESH_TOKEN_COOKIE = "crm_refresh_token";
const SESSION_ID_COOKIE = "crm_session_id";

function getAccessTokenTtlMs() {
  return env.accessTokenTtlMinutes * 60 * 1000;
}

function getRefreshTokenTtlMs() {
  return env.refreshTokenTtlDays * 24 * 60 * 60 * 1000;
}

function hashToken(token = "") {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, passwordHash = "") {
  const [salt, storedHash] = String(passwordHash).split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt, 64);
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, derivedKey);
}

function createOpaqueToken() {
  return crypto.randomBytes(48).toString("base64url");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "";
}

function createSessionTokens(req) {
  const now = Date.now();
  const sessionId = crypto.randomUUID();
  const accessToken = createOpaqueToken();
  const refreshToken = createOpaqueToken();

  return {
    sessionId,
    accessToken,
    refreshToken,
    session: {
      sessionId,
      accessTokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(refreshToken),
      accessTokenExpiresAt: new Date(now + getAccessTokenTtlMs()),
      refreshTokenExpiresAt: new Date(now + getRefreshTokenTtlMs()),
      userAgent: req.get("user-agent") || "",
      ipAddress: getClientIp(req),
      createdAt: new Date(now),
      lastUsedAt: new Date(now),
    },
  };
}

function rotateSessionTokens(session, req) {
  const now = Date.now();
  const accessToken = createOpaqueToken();
  const refreshToken = createOpaqueToken();

  session.accessTokenHash = hashToken(accessToken);
  session.refreshTokenHash = hashToken(refreshToken);
  session.accessTokenExpiresAt = new Date(now + getAccessTokenTtlMs());
  session.refreshTokenExpiresAt = new Date(now + getRefreshTokenTtlMs());
  session.lastUsedAt = new Date(now);
  session.userAgent = req.get("user-agent") || session.userAgent || "";
  session.ipAddress = getClientIp(req) || session.ipAddress || "";

  return {
    sessionId: session.sessionId,
    accessToken,
    refreshToken,
    session,
  };
}

function readBearerToken(req) {
  const authorization = req.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";

  return cookieHeader
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const separatorIndex = item.indexOf("=");

      if (separatorIndex < 0) {
        return cookies;
      }

      const key = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function getRefreshContext(req) {
  const cookies = parseCookies(req);
  const payload = req.body || {};

  return {
    sessionId:
      payload.sessionId ||
      req.get("x-session-id") ||
      cookies[SESSION_ID_COOKIE] ||
      null,
    refreshToken:
      payload.refreshToken ||
      req.get("x-refresh-token") ||
      cookies[REFRESH_TOKEN_COOKIE] ||
      null,
  };
}

function setRefreshCookies(res, tokens) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    expires: tokens.session.refreshTokenExpiresAt,
    path: "/",
  };

  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, cookieOptions);
  res.cookie(SESSION_ID_COOKIE, tokens.sessionId, cookieOptions);
}

function clearRefreshCookies(res) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    path: "/",
  };

  res.clearCookie(REFRESH_TOKEN_COOKIE, cookieOptions);
  res.clearCookie(SESSION_ID_COOKIE, cookieOptions);
}

function buildAuthResponse(user, tokens, serializer) {
  return {
    user: serializer(user),
    sessionId: tokens.sessionId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: tokens.session.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens.session.refreshTokenExpiresAt,
  };
}

module.exports = {
  REFRESH_TOKEN_COOKIE,
  SESSION_ID_COOKIE,
  buildAuthResponse,
  clearRefreshCookies,
  createSessionTokens,
  getRefreshContext,
  hashPassword,
  hashToken,
  readBearerToken,
  rotateSessionTokens,
  setRefreshCookies,
  verifyPassword,
};
