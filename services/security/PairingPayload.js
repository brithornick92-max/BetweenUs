/**
 * PairingPayload v2
 *
 * v1 (REMOVED): QR contained the raw invite secret — anyone who
 *   photographs the QR code derives the couple key forever.
 *
 * v2: QR contains only the inviter's X25519 PUBLIC KEY.
 *   - Inviter: generates keypair, puts publicKey in QR.
 *   - Scanner: scans QR, generates own keypair, derives shared secret
 *     via box.before(inviterPubKey, scannerSecretKey), runs HKDF.
 *   - Scanner uploads own publicKey to Supabase couple_members.
 *   - Inviter reads scanner's publicKey, derives same shared secret.
 *
 * Payload shape: { v:2, t:"betweenus_pair", coupleId, publicKey, createdAt }
 */

export const PAIRING_PAYLOAD_TYPE = "betweenus_pair";
export const PAIRING_PAYLOAD_VERSION = 2;

/**
 * Build the QR code payload (inviter side).
 * @param {{ coupleId: string, publicKey: string }} params
 *   publicKey is the inviter's X25519 public key, base64-encoded.
 */
export function makePairingPayload({ coupleId, publicKey }) {
  if (!coupleId || !publicKey) {
    throw new Error("makePairingPayload: coupleId and publicKey are required");
  }
  return {
    v: PAIRING_PAYLOAD_VERSION,
    t: PAIRING_PAYLOAD_TYPE,
    coupleId,
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

  if (obj.v !== 2) {
    return {
      ok: false,
      error: "This QR code uses an older pairing format. Ask your partner to regenerate it.",
    };
  }

  if (!obj.coupleId || !obj.publicKey) {
    return { ok: false, error: "QR code is missing required data." };
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
