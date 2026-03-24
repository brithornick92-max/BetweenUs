/**
 * PairingPayload v3
 *
 * v1 (REMOVED): QR contained the raw invite secret — anyone who
 *   photographs the QR code derives the couple key forever.
 *
 * v3: QR contains a one-time pairing code plus the inviter's X25519 PUBLIC KEY.
 *   - Inviter: creates the couple, requests a short-lived pairing code, and
 *     embeds pairingCode + publicKey in the QR.
 *   - Scanner: scans QR, generates or loads their device keypair, and redeems
 *     pairingCode server-side while sending their public key.
 *   - Inviter reads scanner's publicKey from Supabase and derives the same
 *     shared secret.
 *
 * Payload shape: { v:3, t:"betweenus_pair", pairingCode, publicKey, createdAt }
 */

export const PAIRING_PAYLOAD_TYPE = "betweenus_pair";
export const PAIRING_PAYLOAD_VERSION = 3;

/**
 * Build the QR code payload (inviter side).
 * @param {{ pairingCode: string, publicKey: string }} params
 *   publicKey is the inviter's X25519 public key, base64-encoded.
 */
export function makePairingPayload({ pairingCode, publicKey }) {
  if (!pairingCode || !publicKey) {
    throw new Error("makePairingPayload: pairingCode and publicKey are required");
  }
  return {
    v: PAIRING_PAYLOAD_VERSION,
    t: PAIRING_PAYLOAD_TYPE,
    pairingCode,
    publicKey,
    createdAt: Date.now(),
  };
}

/**
 * Parse & validate a scanned QR payload.
 * @returns {{ ok: boolean, payload?: object, error?: string }}
 */
export function parsePairingPayload(raw) {
  let obj;
  try {
    obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return { ok: false, error: "Invalid QR code." };
  }

  if (!obj || obj.t !== PAIRING_PAYLOAD_TYPE) {
    return { ok: false, error: "Unrecognized QR code." };
  }

  if (obj.v !== 3) {
    return {
      ok: false,
      error: "This QR code uses an older pairing format. Ask your partner to regenerate it.",
    };
  }

  if (!obj.pairingCode || !obj.publicKey) {
    return { ok: false, error: "QR code is missing required data." };
  }

  if (typeof obj.pairingCode !== "string" || obj.pairingCode.length < 6) {
    return { ok: false, error: "QR code contains an invalid pairing code." };
  }

  // Basic sanity: X25519 public key is 32 bytes = 44 chars base64
  if (typeof obj.publicKey !== "string" || obj.publicKey.length < 40) {
    return { ok: false, error: "QR code contains an invalid key." };
  }

  // Reject expired codes (> 15 minutes old)
  if (obj.createdAt && Date.now() - obj.createdAt > 15 * 60 * 1000) {
    return { ok: false, error: "This pairing code has expired. Ask your partner to create a new one." };
  }

  return { ok: true, payload: obj };
}
