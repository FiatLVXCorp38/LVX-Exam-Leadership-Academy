import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticatedUser, json, paypalAccessToken, paypalBase } from "../_shared_paypal.ts";

const PLANS: Record<number, number> = { 30: 5900, 60: 7900, 90: 9900 };
const COURSES: Record<string, string> = {
  ENTRY: "Correction Officer — Entry",
  SERGEANT: "Correction Sergeant — Promotional",
  LIEUTENANT: "Correction Lieutenant — Promotional",
  CAPTAIN: "Correction Captain — Promotional",
  CHIEF: "Correction Chief — Promotional",
};
const cors = {
  "Access-Control-Allow-Origin": "https://fiatlvxcorp38.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "POST required." }, 405);

  try {
    const auth = await authenticatedUser(req);
    if ("error" in auth) return reply({ error: auth.error }, auth.status);
    const body = await req.json().catch(() => ({}));
    const days = Number(body.days);
    const courseCode = String(body.course_code || "").trim().toUpperCase();
    if (!Object.hasOwn(PLANS, days)) return reply({ error: "Choose 30, 60, or 90 days." }, 400);
    if (!Object.hasOwn(COURSES, courseCode)) return reply({ error: "Choose one of the five correctional courses." }, 400);

    const { data: course, error: courseError } = await auth.admin
      .from("courses")
      .select("id, course_code, is_active")
      .eq("course_code", courseCode)
      .eq("is_active", true)
      .maybeSingle();
    if (courseError) throw courseError;
    if (!course) return reply({ error: `${COURSES[courseCode]} is not available for purchase.` }, 409);

    const { data: payment, error: insertError } = await auth.admin
      .from("lvx_payment_orders")
      .insert({
        student_id: auth.user.id,
        course_id: course.id,
        course_code: courseCode,
        access_days: days,
        amount_cents: PLANS[days],
        currency: "USD",
        status: "pending",
      })
      .select("id, amount_cents, currency, access_days")
      .single();
    if (insertError) throw insertError;

    const accessToken = await paypalAccessToken();
    const amount = (payment.amount_cents / 100).toFixed(2);
    const site = "https://fiatlvxcorp38.github.io/LVX-Exam-Leadership-Academy/";
    const response = await fetch(`${paypalBase()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": payment.id,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: `LVX-${courseCode}`,
          custom_id: payment.id,
          invoice_id: `LVX-${payment.id}`,
          description: `LVX ${COURSES[courseCode]} - ${days} days`,
          amount: { currency_code: "USD", value: amount },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "LVX Exam & Leadership Academy",
              user_action: "PAY_NOW",
              return_url: `${site}?lvx_paypal=return`,
              cancel_url: `${site}?lvx_paypal=cancel`,
              shipping_preference: "NO_SHIPPING",
            },
          },
        },
      }),
    });
    const order = await response.json();
    if (!response.ok || !order.id) {
      await auth.admin.from("lvx_payment_orders").update({ status: "failed" }).eq("id", payment.id);
      console.error("PayPal order create failed", order);
      return reply({ error: "PayPal could not create the order. Please try again." }, 502);
    }

    const { error: updateError } = await auth.admin
      .from("lvx_payment_orders")
      .update({ paypal_order_id: order.id })
      .eq("id", payment.id);
    if (updateError) throw updateError;

    const approval = (order.links || []).find((link: any) => link.rel === "approve" || link.rel === "payer-action")?.href;
    if (!approval) throw new Error("PayPal did not return an approval link.");
    return reply({ approval_url: approval });
  } catch (error) {
    console.error("LVX PayPal create order error", error);
    return reply({ error: error instanceof Error ? error.message : "Checkout could not start." }, 500);
  }
});
