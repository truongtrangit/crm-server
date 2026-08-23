/**
 * Extracts and sanitizes request metadata (IP, user agent, sanitized body).
 * Useful for logging and error reporting.
 * @param {import('express').Request} req - The Express request object
 * @returns {Object} Extracted request metadata
 */
function extractRequestMeta(req) {
  const ipAddress =
    req?.headers?.['cf-connecting-ip'] ||
    (req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim() ||
    req?.ip ||
    req?.socket?.remoteAddress ||
    '';

  const meta = {
    method: req?.method,
    url: req?.originalUrl || req?.url,
    ip: ipAddress,
    userAgent: req?.get ? req.get('user-agent') : req?.headers?.['user-agent'] || '',
  };

  if (req?.query && Object.keys(req.query).length > 0) {
    meta.query = req.query;
  }

  if (req?.user?.id) {
    meta.userId = req.user.id;
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req?.method) && req?.body && Object.keys(req.body).length > 0) {
    const sanitized = { ...req.body };
    const sensitiveKeys = [
      'password',
      'newPassword',
      'currentPassword',
      'passwordHash',
      'resetToken',
      'refreshToken',
      'accessToken',
    ];

    for (const key of sensitiveKeys) {
      if (sanitized[key] !== undefined) {
        sanitized[key] = '***';
      }
    }

    meta.body = sanitized;
  }

  return meta;
}

module.exports = {
  extractRequestMeta,
};
