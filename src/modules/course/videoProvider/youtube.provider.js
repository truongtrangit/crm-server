/**
 * YouTube Video Provider
 *
 * Builds hardened YouTube embed URLs with privacy and security params.
 * Uses youtube-nocookie.com for enhanced privacy mode.
 *
 * To swap to a different provider later:
 *   1. Create a new provider class with same interface
 *   2. Set VIDEO_PROVIDER env var to the new provider name
 *   3. No changes needed in service/controller code
 */

class YouTubeProvider {
  constructor() {
    this.domain = 'https://www.youtube-nocookie.com';
    this.originDomain = process.env.BOTVN_DOMAIN || 'https://botvn.com';
  }

  /**
   * @returns {'iframe'|'video'} — How frontend should render this URL
   * - 'iframe': Render in <iframe> (YouTube, Vimeo)
   * - 'video':  Render in <video> tag (S3 signed URL, proxy stream)
   */
  getPlayerType() {
    return 'iframe';
  }

  /**
   * Extract YouTube video ID from various URL formats.
   * @param {string} rawUrl
   * @returns {string|null}
   */
  extractVideoId(rawUrl) {
    if (!rawUrl) return null;

    try {
      const parsed = new URL(rawUrl);

      // https://www.youtube.com/watch?v=VIDEO_ID
      if (
        parsed.hostname.includes('youtube.com') &&
        parsed.pathname === '/watch'
      ) {
        return parsed.searchParams.get('v') || null;
      }

      // https://www.youtube.com/embed/VIDEO_ID
      if (
        parsed.hostname.includes('youtube.com') &&
        parsed.pathname.startsWith('/embed/')
      ) {
        return parsed.pathname.split('/embed/')[1]?.split('?')[0] || null;
      }

      // https://youtu.be/VIDEO_ID
      if (parsed.hostname.includes('youtu.be')) {
        return parsed.pathname.slice(1)?.split('?')[0] || null;
      }
    } catch (e) {
      // Not a valid URL
    }

    return null;
  }

  /**
   * Build secure video config from a raw video URL.
   * For YouTube: returns videoId + playerVars for IFrame API (no static iframe src).
   * For non-YouTube: returns embedUrl for direct rendering.
   * @param {string} rawUrl — The original videoUrl stored in DB
   * @returns {{ playerType: string, videoId?: string, playerVars?: object, host?: string, embedUrl?: string } | null}
   */
  buildEmbedUrl(rawUrl) {
    if (!rawUrl) return null;

    const videoId = this.extractVideoId(rawUrl);

    if (!videoId) {
      // Not a YouTube URL — return as-is (fallback for non-YouTube video files)
      return {
        embedUrl: rawUrl,
        playerType: 'video',
      };
    }

    return {
      videoId,
      playerType: 'youtube-api',
      host: this.domain,
      playerVars: {
        rel: 0,           // Không hiện video liên quan cuối video
        modestbranding: 1, // Ẩn logo YouTube lớn
        iv_load_policy: 3, // Ẩn annotations
        playsinline: 1,    // Play inline trên mobile
        enablejsapi: 1,    // Cho phép JS API (tracking)
        origin: this.originDomain,
      },
    };
  }
}

module.exports = YouTubeProvider;
