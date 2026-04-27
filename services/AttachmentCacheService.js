/**
 * Attachment cache helper.
 *
 * Current media writes go directly through SupabaseDataLayer. This helper only
 * resolves already-known local/remote URIs for legacy view code.
 */

const AttachmentCacheService = {
  async getCachedUri(ref) {
    if (!ref || typeof ref !== 'string') return null;
    if (
      ref.startsWith('file:') ||
      ref.startsWith('content:') ||
      ref.startsWith('http://') ||
      ref.startsWith('https://')
    ) {
      return ref;
    }
    return null;
  },

  async uploadAllPending() {
    return { uploaded: 0, failed: 0 };
  },

  async deleteAttachment() {
    return true;
  },

  async clearCache() {
    return true;
  },
};

export default AttachmentCacheService;
