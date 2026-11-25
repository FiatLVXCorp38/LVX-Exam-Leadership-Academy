// LVX PayPal checkout client. PayPal secrets and service-role keys remain server-side.
(() => {
  const SUPABASE_URL = "https://khnhhppjggnuahaipzme.supabase.co";
  // Must match the publishable key in auth.js exactly.
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_V55KI5c564HwzTZ-60-J2A_E1MAeaxE";
  const SITE_URL = "https://fiatlvxcorp38.github.io/LVX-Exam-Leadership-Academy/";
  const prices = { 30: "$59", 60: "$79", 90: "$99" };
  const courseNames = {
    ENTRY: "Correction Officer Entry",
    SERGEANT: "Correction Sergeant Promotional",
    LIEUTENANT: "Correction Lieutenant Promotional",
    CAPTAIN: "Correction Captain Promotional",
    CHIEF: "Correction Chief Promotional",
  };

  const message = (text, error = false) => {
    const el = document.getElementById("lvxPayPalMessage");
    if (el) {
      el.textContent = text;
      el.style.color = error ? "#ffaaa3" : "#e5c77f";
    }
  };

  async function currentSession() {
    if (!window.lvxSupabase) throw new Error("The secure sign-in service is still loading. Refresh and try again.");
    const { data, error } = await window.lvxSupabase.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      document.getElementById("authGate")?.classList.remove("hidden");
      document.getElementById("publicHome")?.classList.add("hidden");
      document.getElementById("authGate")?.scrollIntoView({ behavior: "smooth", block: "start" });
      throw new Error("Sign in or create your student account before checkout.");
    }
    return data.session;
  }

  async function invoke(name, payload) {
    const session = await currentSession();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(data.error || "Checkout request failed.");
    return data;
  }

  async function choose(days) {
    if (!prices[days]) return;
    try {
      const courseCode = document.getElementById("lvxCourseSelect")?.value;
      if (!courseNames[courseCode]) throw new Error("Select a correctional course first.");
      message(`Preparing your ${days}-day ${courseNames[courseCode]} checkout (${prices[days]})…`);
      const result = await invoke("lvx-paypal-create-order", { days, course_code: courseCode });
      if (!result.approval_url) throw new Error("PayPal did not return an approval link.");
      window.location.assign(result.approval_url);
    } catch (error) {
      message(error.message || "Checkout could not start.", true);
    }
  }

  async function handleReturn() {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("lvx_paypal");
    if (state === "cancel") {
      message("Checkout was cancelled. No course access was granted.");
      history.replaceState({}, "", SITE_URL);
      return;
    }
    if (state !== "return") return;

    const orderId = params.get("token");
    if (!orderId) {
      message("PayPal returned without an order reference. No course access was granted.", true);
      return;
    }

    try {
      message("Verifying your PayPal payment and activating course access…");
      // invoke() waits for the persisted Supabase session and uses the authenticated student's token.
      const result = await invoke("lvx-paypal-capture-order", { order_id: orderId });
      message(result.message || "Payment verified. Your course access is active.");
      history.replaceState({}, "", SITE_URL);
      if (window.lvxRefreshEnrollment) {
        await window.lvxRefreshEnrollment();
      }
    } catch (error) {
      message(error.message || "We could not verify this payment yet. Do not pay again until LVX support has checked the order.", true);
    }
  }

  window.LVXPayPal = { choose, handleReturn };

  // Also works if this script is injected after DOMContentLoaded.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", handleReturn, { once: true });
  } else {
    handleReturn();
  }
})();
