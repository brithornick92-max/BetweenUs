/**
 * Supabase Edge Function — Password Recovery Code Flow
 *
 * Actions:
 *   POST { action: 'send', email }
 *   POST { action: 'verify', email, code, password }
 *
 * Required secrets:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY
 *   RECOVERY_CODE_FROM_EMAIL
 * Optional secrets:
 *   RECOVERY_CODE_PEPPER
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CODE_TTL_MINUTES = 15;
const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const MIN_RESEND_INTERVAL_MS = 60_000;
const SEND_RATE_LIMIT_WINDOW_MS = 15 * 60_000;
const SEND_RATE_LIMIT_MAX_REQUESTS = 5;

type SendPayload = {
  action: "send";
  email?: string;
};

type VerifyPayload = {
  action: "verify";
  email?: string;
  code?: string;
  password?: string;
};

type RecoveryPayload = SendPayload | VerifyPayload;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

const normalizeEmail = (value: string | undefined) => String(value || "").trim().toLowerCase();

const normalizeIp = (value: string | null | undefined) => {
  if (!value) return null;
  const firstValue = value.split(",")[0]?.trim();
  return firstValue || null;
};

const isValidEmail = (email: string) => /.+@.+\..+/.test(email);

const isValidCode = (code: string) => /^\d{6}$/.test(code);

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getClientIp(req: Request) {
  return normalizeIp(
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("fly-client-ip")
  );
}

async function enforceSendRateLimit(supabase: ReturnType<typeof createClient>, email: string, req: Request) {
  const clientIp = getClientIp(req);
  const identifiers = [`email:${email}`];

  if (clientIp) {
    identifiers.push(`ip:${clientIp}`);
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  for (const identifier of identifiers) {
    const identifierHash = await sha256Hex(identifier);
    const { data: existing, error: lookupError } = await supabase
      .from("password_recovery_request_limits")
      .select("id, request_count, window_started_at")
      .eq("identifier_hash", identifierHash)
      .eq("action", "send")
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (!existing?.id) {
      const { error: insertError } = await supabase
        .from("password_recovery_request_limits")
        .insert({
          identifier_hash: identifierHash,
          action: "send",
          request_count: 1,
          window_started_at: nowIso,
          last_request_at: nowIso,
          updated_at: nowIso,
        });

      if (insertError) {
        throw insertError;
      }

      continue;
    }

    const windowStartedAt = new Date(existing.window_started_at).getTime();
    const windowExpired = Number.isNaN(windowStartedAt) || now - windowStartedAt >= SEND_RATE_LIMIT_WINDOW_MS;

    if (windowExpired) {
      const { error: resetError } = await supabase
        .from("password_recovery_request_limits")
        .update({
          request_count: 1,
          window_started_at: nowIso,
          last_request_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", existing.id);

      if (resetError) {
        throw resetError;
      }

      continue;
    }

    if ((existing.request_count || 0) >= SEND_RATE_LIMIT_MAX_REQUESTS) {
      return false;
    }

    const { error: updateError } = await supabase
      .from("password_recovery_request_limits")
      .update({
        request_count: (existing.request_count || 0) + 1,
        last_request_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw updateError;
    }
  }

  return true;
}

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(bytes[0] % 1_000_000).padStart(CODE_LENGTH, "0");
}

async function sendRecoveryEmail(to: string, code: string) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RECOVERY_CODE_FROM_EMAIL");

  if (!resendApiKey || !fromEmail) {
    throw new Error("Recovery email provider is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: "Your Between Us recovery code",
      text: `Your Between Us recovery code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. If you did not request it, you can ignore this email.`,
      html: `<p>Your Between Us recovery code is <strong style="font-size:22px;letter-spacing:3px;">${code}</strong>.</p><p>It expires in ${CODE_TTL_MINUTES} minutes.</p><p>If you did not request it, you can ignore this email.</p>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Recovery email send failed: ${body}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let payload: RecoveryPayload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const pepper = Deno.env.get("RECOVERY_CODE_PEPPER");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Server misconfigured" });
  }
  if (!pepper) {
    console.error("[password-recovery] RECOVERY_CODE_PEPPER is not configured");
    return json(500, { error: "Recovery is temporarily unavailable." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (payload.action === "send") {
    const email = normalizeEmail(payload.email);
    if (!isValidEmail(email)) {
      return json(400, { error: "Enter a valid email address." });
    }

    try {
      const allowed = await enforceSendRateLimit(supabase, email, req);
      if (!allowed) {
        return json(429, { error: "Too many recovery requests. Please wait a few minutes before trying again." });
      }
    } catch (rateLimitError) {
      console.error("[password-recovery] request rate limit failed", rateLimitError);
      return json(500, { error: "Unable to send a recovery code right now." });
    }

    const nowIso = new Date().toISOString();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("[password-recovery] profile lookup failed", profileError);
      return json(500, { error: "Unable to send a recovery code right now." });
    }

    const { data: existingCode, error: existingError } = await supabase
      .from("password_recovery_codes")
      .select("id, created_at")
      .eq("email", email)
      .is("consumed_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("[password-recovery] active code lookup failed", existingError);
      return json(500, { error: "Unable to send a recovery code right now." });
    }

    if (existingCode?.created_at) {
      const lastCreatedAt = new Date(existingCode.created_at).getTime();
      if (!Number.isNaN(lastCreatedAt) && Date.now() - lastCreatedAt < MIN_RESEND_INTERVAL_MS) {
        return json(429, { error: "Please wait a minute before requesting another code." });
      }
    }

    if (!profile?.id) {
      return json(200, { ok: true });
    }

    const code = generateCode();
    const codeHash = await sha256Hex(`${email}:${code}:${pepper}`);
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

    await supabase
      .from("password_recovery_codes")
      .delete()
      .eq("email", email)
      .is("consumed_at", null);

    const { error: insertError } = await supabase
      .from("password_recovery_codes")
      .insert({
        user_id: profile.id,
        email,
        code_hash: codeHash,
        attempts: 0,
        expires_at: expiresAt,
        consumed_at: null,
        last_sent_at: nowIso,
        updated_at: nowIso,
      });

    if (insertError) {
      console.error("[password-recovery] insert failed", insertError);
      return json(500, { error: "Unable to send a recovery code right now." });
    }

    try {
      await sendRecoveryEmail(email, code);
    } catch (error) {
      console.error("[password-recovery] email send failed", error);
      await supabase
        .from("password_recovery_codes")
        .delete()
        .eq("email", email)
        .is("consumed_at", null);
      return json(500, { error: "Unable to send a recovery code right now." });
    }

    return json(200, { ok: true });
  }

  if (payload.action === "verify") {
    const email = normalizeEmail(payload.email);
    const code = String(payload.code || "").trim();
    const password = String(payload.password || "");

    if (!isValidEmail(email)) {
      return json(400, { error: "Enter a valid email address." });
    }
    if (!isValidCode(code)) {
      return json(400, { error: "Enter the 6-digit recovery code." });
    }
    if (!password || password.length < 8) {
      return json(400, { error: "Password must be at least 8 characters." });
    }

    const nowIso = new Date().toISOString();
    const { data: recoveryRow, error: rowError } = await supabase
      .from("password_recovery_codes")
      .select("id, user_id, code_hash, attempts, expires_at")
      .eq("email", email)
      .is("consumed_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rowError) {
      console.error("[password-recovery] verify lookup failed", rowError);
      return json(500, { error: "Unable to verify the recovery code right now." });
    }

    if (!recoveryRow?.id || !recoveryRow?.user_id) {
      return json(400, { error: "That recovery code is invalid or expired." });
    }

    if ((recoveryRow.attempts || 0) >= MAX_ATTEMPTS) {
      await supabase
        .from("password_recovery_codes")
        .update({
          consumed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", recoveryRow.id);
      return json(429, { error: "Too many attempts. Request a new recovery code." });
    }

    const submittedHash = await sha256Hex(`${email}:${code}:${pepper}`);
    if (submittedHash !== recoveryRow.code_hash) {
      const nextAttempts = (recoveryRow.attempts || 0) + 1;
      await supabase
        .from("password_recovery_codes")
        .update({
          attempts: nextAttempts,
          consumed_at: nextAttempts >= MAX_ATTEMPTS ? nowIso : null,
          updated_at: nowIso,
        })
        .eq("id", recoveryRow.id);
      return json(
        nextAttempts >= MAX_ATTEMPTS ? 429 : 400,
        { error: nextAttempts >= MAX_ATTEMPTS ? "Too many attempts. Request a new recovery code." : "That recovery code is invalid or expired." }
      );
    }

    const { error: updateUserError } = await supabase.auth.admin.updateUserById(recoveryRow.user_id, {
      password,
    });

    if (updateUserError) {
      console.error("[password-recovery] password update failed", updateUserError);
      return json(500, { error: "Unable to reset your password right now." });
    }

    const { error: consumeError } = await supabase
      .from("password_recovery_codes")
      .update({
        consumed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("email", email)
      .is("consumed_at", null);

    if (consumeError) {
      console.error("[password-recovery] consume failed", consumeError);
    }

    return json(200, { ok: true });
  }

  return json(400, { error: "Unsupported action" });
});