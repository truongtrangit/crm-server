/**
 * Video Provider Abstraction Layer
 * 
 * Strategy pattern cho video delivery. Hiện tại dùng YouTube,
 * sau có thể swap sang Bunny Stream, S3 signed URL, hoặc proxy
 * mà KHÔNG cần sửa service/controller code.
 * 
 * Cách dùng:
 *   const provider = getVideoProvider();
 *   const result = provider.buildEmbedUrl(rawVideoUrl);
 * 
 * Cách thêm provider mới:
 *   1. Tạo class implement interface { buildEmbedUrl(rawUrl), getPlayerType() }
 *   2. Thêm vào switch trong getVideoProvider()
 *   3. Set VIDEO_PROVIDER env var
 */

const YouTubeProvider = require('./youtube.provider');

const PROVIDERS = {
  youtube: YouTubeProvider,
  // Thêm provider mới ở đây:
  // bunny: BunnyProvider,
  // s3: S3SignedUrlProvider,
  // proxy: ProxyProvider,
};

let _providerInstance = null;

/**
 * Get the configured video provider (singleton).
 * Defaults to 'youtube' if VIDEO_PROVIDER env is not set.
 */
function getVideoProvider() {
  if (_providerInstance) return _providerInstance;

  const providerName = process.env.VIDEO_PROVIDER || 'youtube';
  const ProviderClass = PROVIDERS[providerName];

  if (!ProviderClass) {
    throw new Error(
      `Unknown VIDEO_PROVIDER: "${providerName}". Available: ${Object.keys(PROVIDERS).join(', ')}`,
    );
  }

  _providerInstance = new ProviderClass();
  return _providerInstance;
}

/**
 * Reset provider instance (useful for testing or hot-reload).
 */
function resetVideoProvider() {
  _providerInstance = null;
}

module.exports = {
  getVideoProvider,
  resetVideoProvider,
};
