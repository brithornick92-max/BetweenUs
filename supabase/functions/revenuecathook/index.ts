/**
 * Supabase Edge Function — RevenueCat Webhook Handler
 *
 * Receives webhook events from RevenueCat, verifies the bearer token,
 * and updates the `user_entitlements` table + couple premium status.
 *
 * SETUP:
 *   1. Deploy:   supabase functions deploy revenuecathook --no-verify-jwt
 *   2. Set secret: supabase secrets set REVENUECAT_WEBHOOK_TOKEN="<token>"
 *   3. In RevenueCat Dashboard → Integrations → Webhooks:
 *        URL:   https://<project-ref>.supabase.co/functions/v1/revenuecathook
 *        Auth:  Bearer <same token you set above>
 *
 * The function uses the Supabase service_role key to bypass RLS and write
 * directly to `user_entitlements` and update couple premium status.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENTITLEMENT_ID = "Between Us Pro";

// Events that grant premium
const GRANT_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "PRODUCT_CHANGE",
]);

// Events that revoke premium
const REVOKE_EVENTS = new Set([
  "EXPIRATION",
  "BILLING_ISSUE",
]);

// Events where we clear premium only after grace (RevenueCat retries billing)
const CANCEL_EVENTS = new Set([
  "CANCELLATION",
]);

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify bearer token
  const webhookToken = Deno.env.get("REVENUECAT_WEBHOOK_TOKEN");
  if (!webhookToken) {
    console.error("REVENUECAT_WEBHOOK_TOKEN not set");
    return new Response("Server misconfigured", { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token || token !== webhookToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = (body as { event?: Record<string, unknown> }).event;
  if (!event) {
    return new Response("Missing event object", { status: 400 });
  }

  const eventType = event.type as string | undefined;
  const appUserId = event.app_user_id as string | undefined;
  const productId = event.product_id as string | undefined;
  const entitlementIds = (event.entitlement_ids as string[]) ?? [];
  const expirationAtMs = event.expiration_at_ms as number | undefined;

  if (!eventType || !appUserId) {
    return new Response("Missing event.type or event.app_user_id", {
      status: 400,
    });
  }

  // Only process events related to our entitlement
  const relevant =
    entitlementIds.length === 0 || entitlementIds.includes(ENTITLEMENT_ID);
  if (!relevant) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create Supabase admin client (service_role bypasses RLS)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let isPremium: boolean;
  let expiresAt: string | null = null;

  if (GRANT_EVENTS.has(eventType)) {
    isPremium = true;
    expiresAt = expirationAtMs
      ? new Date(expirationAtMs).toISOString()
      : null;
  } else if (REVOKE_EVENTS.has(eventType)) {
    isPremium = false;
  } else if (CANCEL_EVENTS.has(eventType)) {
    // On cancellation, keep premium until expiration
    isPremium = true;
    expiresAt = expirationAtMs
      ? new Date(expirationAtMs).toISOString()
      : null;
  } else {
    // Unhandled event type (TRANSFER, SUBSCRIBER_ALIAS, etc.) — acknowledge
    return new Response(JSON.stringify({ ok: true, unhandled: eventType }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Upsert user_entitlements
  const { error: upsertError } = await supabase
    .from("user_entitlements")
    .upsert(
      {
        user_id: appUserId,
        is_premium: isPremium,
        entitlement_id: ENTITLEMENT_ID,
        product_id: productId ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    console.error("Failed to upsert user_entitlements:", upsertError);
    return new Response("Database error", { status: 500 });
  }

  // Propagate premium to the couple (shared premium)
  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", appUserId)
    .maybeSingle();

  if (membership?.couple_id) {
    // Determine premium_source: check if EITHER partner has active premium
    const { data: coupleEntitlements } = await supabase
      .from("couple_members")
      .select("user_id, user_entitlements(is_premium, expires_at)")
      .eq("couple_id", membership.couple_id);

    const anyPremium = (coupleEntitlements ?? []).some((m: Record<string, unknown>) => {
      const ent = m.user_entitlements as { is_premium?: boolean; expires_at?: string } | null;
      return (
        ent?.is_premium &&
        (!ent.expires_at || new Date(ent.expires_at) > new Date())
      );
    });

    const premiumSource = anyPremium
      ? isPremium
        ? appUserId
        : (coupleEntitlements ?? []).find((m: Record<string, unknown>) => {
            const ent = m.user_entitlements as { is_premium?: boolean; expires_at?: string } | null;
            return (
              ent?.is_premium &&
              (!ent.expires_at || new Date(ent.expires_at) > new Date())
            );
          })?.user_id ?? "none"
      : "none";

    await supabase
      .from("couples")
      .update({
        is_premium: anyPremium,
        premium_since: anyPremium ? new Date().toISOString() : null,
        premium_source: premiumSource,
        updated_at: new Date().toISOString(),
      })
      .eq("id", membership.couple_id);
  }

  console.log(
    `[revenuecathook] ${eventType} for ${appUserId}: premium=${isPremium}`
  );

  return new Response(
    JSON.stringify({ ok: true, event_type: eventType, is_premium: isPremium }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
