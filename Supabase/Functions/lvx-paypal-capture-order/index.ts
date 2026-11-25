import { authenticatedUser, paypalAccessToken, paypalBase } from "../_shared_paypal.ts";

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
    const orderId = String(body.order_id || "").trim();
    if (!orderId) return reply({ error: "PayPal order ID is required." }, 400);

    const { data: payment, error: paymentError } = await auth.admin
      .from("lvx_payment_orders")
      .select("*")
      .eq("paypal_order_id", orderId)
      .eq("student_id", auth.user.id)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) return reply({ error: "This payment order does not belong to your account." }, 404);

    if (payment.status === "completed") {
      return reply({ status: "completed", message: "Your course access has already been activated." });
    }
    if (payment.status !== "pending") return reply({ error: "This payment order is not pending." }, 409);

    const accessToken = await paypalAccessToken();
    const base = paypalBase();

    // Read the PayPal order first. Capture only after confirming our stored order metadata and amount.
    const readResponse = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const readOrder = await readResponse.json();
    if (!readResponse.ok) {
      console.error("PayPal order lookup failed", readOrder);
      return reply({ error: "PayPal could not verify this order." }, 502);
    }

    const unit = readOrder.purchase_units?.[0];
    const expectedAmount = (payment.amount_cents / 100).toFixed(2);
    if (
      unit?.custom_id !== payment.id ||
      unit?.amount?.currency_code !== "USD" ||
      unit?.amount?.value !== expectedAmount
    ) {
      return reply({ error: "The PayPal order does not match this LVX purchase." }, 409);
    }

    let captureOrder = readOrder;
    if (readOrder.status !== "COMPLETED") {
      const captureResponse = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `capture-${payment.id}`,
        },
        body: "{}",
      });
      captureOrder = await captureResponse.json();
      if (!captureResponse.ok) {
        console.error("PayPal capture failed", captureOrder);
        return reply({ error: "PayPal has not confirmed the payment. Please contact support before trying again." }, 502);
      }
    }

    if (captureOrder.status !== "COMPLETED") {
      return reply({ error: "PayPal has not marked this payment as completed." }, 409);
    }
    const capture = captureOrder.purchase_units?.[0]?.payments?.captures?.find((c: any) => c.status === "COMPLETED");
    if (!capture?.id || capture.amount?.currency_code !== "USD" || capture.amount?.value !== expectedAmount) {
      return reply({ error: "The completed PayPal capture could not be verified." }, 409);
    }

    const { data: fulfillment, error: fulfillmentError } = await auth.admin.rpc(
      "lvx_fulfill_paypal_order",
      { p_payment_order_id: payment.id, p_paypal_capture_id: capture.id },
    );
    if (fulfillmentError) throw fulfillmentError;

    return reply({
      status: "completed",
      message: `Payment verified. ${payment.course_code} course access is active.`,
      fulfillment,
    });
  } catch (error) {
    console.error("LVX PayPal capture order error", error);
    return reply({ error: error instanceof Error ? error.message : "Payment verification failed." }, 500);
  }
});
