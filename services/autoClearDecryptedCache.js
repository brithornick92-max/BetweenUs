/**
 * autoClearDecryptedCache.js
 *
 * Previously cleared E2EE-decrypted temp files on app background.
 * E2EE has been removed — this is now a no-op stub kept so App.js
 * import doesn't break.
 */

export function registerAutoClearDecryptedCache() {
  // No-op: no decrypted cache to clear without E2EE.
  return () => {};
}
