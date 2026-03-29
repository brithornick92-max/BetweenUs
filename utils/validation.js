/**
 * validation.js — Centralized input validation for Between Us
 *
 * All form input validation lives here so screens stay thin and
 * validation logic can be tested independently.
 *
 * Each validator returns { valid: boolean, error: string | null }.
 * On success, `error` is null. On failure, `error` is a user-facing
 * message in the app's warm brand voice.
 */

// ─── Result helpers ─────────────────────────────────────────────────

/** @returns {{ valid: true, error: null }} */
const ok = () => ({ valid: true, error: null });

/** @returns {{ valid: false, error: string }} */
const fail = (message) => ({ valid: false, error: message });

// ─── Auth validators ─────────────────────────────────────────────────

/**
 * Validate an email address.
 * @param {string} email
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateEmail(email) {
  if (!email || !email.trim()) return fail("We'd love to have your email — mind filling it in?");
  const trimmed = email.trim();
  // Standard email pattern (RFC 5322 simplified)
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(trimmed)) return fail("That email doesn't look quite right — give it another look?");
  if (trimmed.length > 254) return fail("That email is a bit too long. Try a shorter one?");
  return ok();
}

/**
 * Validate a password for sign-up.
 * @param {string} password
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validatePassword(password) {
  if (!password) return fail("A password keeps your moments safe — please create one.");
  if (password.length < 8) return fail("Your password needs at least 8 characters to keep things secure.");
  if (password.length > 128) return fail("That password is a little long — try something under 128 characters.");
  return ok();
}

/**
 * Validate a password confirmation matches the original.
 * @param {string} password
 * @param {string} confirmation
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validatePasswordConfirmation(password, confirmation) {
  if (!confirmation) return fail("Please confirm your password to continue.");
  if (password !== confirmation) return fail("These passwords don't match — want to try again?");
  return ok();
}

// ─── Profile validators ──────────────────────────────────────────────

/**
 * Validate a display name (used for partner names, profile names).
 * @param {string} name
 * @param {object} [opts]
 * @param {number} [opts.minLength=1]
 * @param {number} [opts.maxLength=50]
 * @param {string} [opts.fieldLabel='Name']
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateDisplayName(name, { minLength = 1, maxLength = 50, fieldLabel = 'Name' } = {}) {
  if (!name || !name.trim()) return fail(`${fieldLabel} can't be empty — what should we call you?`);
  const trimmed = name.trim();
  if (trimmed.length < minLength) return fail(`${fieldLabel} needs at least ${minLength} character${minLength === 1 ? '' : 's'}.`);
  if (trimmed.length > maxLength) return fail(`${fieldLabel} can be up to ${maxLength} characters.`);
  // Reject strings that are only whitespace or special chars
  if (!/\p{L}|\p{N}/u.test(trimmed)) return fail(`${fieldLabel} should contain at least one letter or number.`);
  return ok();
}

// ─── Invite code validators ──────────────────────────────────────────

const INVITE_CODE_PATTERN = /^[A-Z0-9]{6,12}$/i;

/**
 * Validate a pairing invite code.
 * @param {string} code
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateInviteCode(code) {
  if (!code || !code.trim()) return fail("Please enter the invite code your partner shared.");
  const normalized = code.trim().toUpperCase().replace(/[-\s]/g, '');
  if (!INVITE_CODE_PATTERN.test(normalized)) {
    return fail("That code doesn't look right — it should be 6–12 letters and numbers.");
  }
  return ok();
}

// ─── Text content validators ─────────────────────────────────────────

/**
 * Validate a free-form text field (journal entry body, love note, etc.).
 * @param {string} text
 * @param {object} [opts]
 * @param {number} [opts.maxLength=5000]
 * @param {boolean} [opts.required=false]
 * @param {string} [opts.fieldLabel='This field']
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateTextContent(text, { maxLength = 5000, required = false, fieldLabel = 'This field' } = {}) {
  if (required && (!text || !text.trim())) {
    return fail(`${fieldLabel} can't be empty.`);
  }
  if (text && text.length > maxLength) {
    return fail(`${fieldLabel} can be up to ${maxLength.toLocaleString()} characters.`);
  }
  return ok();
}

/**
 * Validate a title field (journal entry title, date night title, etc.).
 * @param {string} title
 * @param {object} [opts]
 * @param {number} [opts.maxLength=200]
 * @param {boolean} [opts.required=false]
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateTitle(title, { maxLength = 200, required = false } = {}) {
  if (required && (!title || !title.trim())) return fail("A title helps you find this later — mind adding one?");
  if (title && title.trim().length > maxLength) return fail(`Title can be up to ${maxLength} characters.`);
  return ok();
}

// ─── PIN validators ──────────────────────────────────────────────────

/**
 * Validate a numeric PIN (app lock).
 * @param {string} pin
 * @param {number} [length=4]
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validatePin(pin, length = 4) {
  if (!pin) return fail(`Please enter a ${length}-digit PIN.`);
  if (!/^\d+$/.test(pin)) return fail("PIN should only contain numbers.");
  if (pin.length !== length) return fail(`PIN must be exactly ${length} digits.`);
  // Reject all-same-digit PINs (e.g. 0000, 1111)
  if (new Set(pin.split('')).size === 1) return fail("Please choose a stronger PIN — try mixing different digits.");
  return ok();
}

/**
 * Validate PIN confirmation matches.
 * @param {string} pin
 * @param {string} confirmation
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validatePinConfirmation(pin, confirmation) {
  if (!confirmation) return fail("Please confirm your PIN.");
  if (pin !== confirmation) return fail("These PINs don't match — give it another try?");
  return ok();
}

// ─── Batch validator ─────────────────────────────────────────────────

/**
 * Run multiple validators and collect all errors.
 * Returns { valid: boolean, errors: string[] }.
 *
 * @param {Array<{ valid: boolean, error: string | null }>} results
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function collectErrors(...results) {
  const errors = results
    .filter(r => !r.valid && r.error)
    .map(r => r.error);
  return { valid: errors.length === 0, errors };
}
