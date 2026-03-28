/**
 * withRetry — Exponential backoff retry utility for network operations.
 *
 * Usage:
 *   const data = await withRetry(() => supabase.rpc('my_rpc'), { maxRetries: 3 });
 */

/**
 * @param {() => Promise<T>} fn        — async function to retry
 * @param {object}           [opts]
 * @param {number}           [opts.maxRetries=3]   — total retry attempts
 * @param {number}           [opts.baseDelay=1000] — initial delay in ms
 * @param {number}           [opts.maxDelay=10000] — cap on delay
 * @param {(err: Error) => boolean} [opts.shouldRetry] — return false to bail early
 * @returns {Promise<T>}
 */
export async function withRetry(fn, opts = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
  } = opts;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries || !shouldRetry(err)) break;
      const jitter = Math.random() * 0.3 + 0.85; // 0.85–1.15
      const delay = Math.min(baseDelay * Math.pow(2, attempt) * jitter, maxDelay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export default withRetry;
