import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "https://fiatlvxcorp38.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

export function paypalBase(): string {
  const env = (Deno.env.get("LVX_PAYPAL_ENV") || "sandbox").toLowerCase();
  if (env === "sandbox") return "https://api-m.sandbox.paypal.com";
  if (env === "live") return "https://api-m.paypal.com";
  throw new Error("LVX_PAYPAL_ENV must be sandbox or live");
}

export async function paypalAccessToken(): Promise<string> {
  const id = required("LVX_PAYPAL_CLIENT_ID");
  const secret = required("LVX_PAYPAL_SECRET");
  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    console.error("PayPal OAuth failed", data);
    throw new Error("PayPal could not authorize the checkout request");
  }
  return data.access_token;
}

export async function authenticatedUser(req: Request) {
  const match = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: "Sign in is required.", status: 401 as const };
  const url = required("SUPABASE_URL");
  const anon = required("SUPABASE_ANON_KEY");
  const service = required("SUPABASE_SERVICE_ROLE_KEY");
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(match[1]);
  if (error || !data.user) return { error: "Your sign-in session is invalid.", status: 401 as const };
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { user: data.user, admin };
}
