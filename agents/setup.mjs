// הקמה חד-פעמית (וגם בכל עדכון של הבוט) — רץ מ-agents-setup.yml אחרי שהבוט עלה ל-Cloudflare:
//   1. רושם את מספר המועדון ל-Cloud API (אם עוד לא רשום)
//   2. מחבר את ה-webhook של Meta לבוט
//   3. מגיש לאישור Meta את תבניות ההודעות שחסרות
//   4. שומר את כתובת הבוט, כדי שהמפקח יבדוק אותה
// מדפיס רק סטטוסים — בלי טוקנים ובלי מספרי טלפון.
import { createHmac } from "node:crypto";
import { firestore } from "./lib/firebase.mjs";
import { TEMPLATES } from "./templates.mjs";

const G = "https://graph.facebook.com/v24.0";
const { WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_WABA_ID, META_APP_ID, META_APP_SECRET, WORKER_URL } = process.env;
for (const [k, v] of Object.entries({ WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_WABA_ID, META_APP_ID, META_APP_SECRET, WORKER_URL }))
  if (!v) throw new Error(`missing ${k}`);

export const derive = (label, secret = META_APP_SECRET) => createHmac("sha256", secret).update(label).digest("hex");

async function graph(path, { method = "GET", body, token = WHATSAPP_TOKEN } = {}) {
  const res = await fetch(`${G}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path.split("?")[0].replace(/\d{6,}/g, "<id>")}: ${j.error?.message || res.status}`);
  return j;
}

const db = firestore();
const botRef = db.collection("agentReports").doc("bot");

// 1. רישום המספר. ה-PIN הוא קוד האימות הדו-שלבי של המספר; נשמר ב-Firestore למקרה שיצטרכו אותו.
const pin = String(parseInt(derive("pin").slice(0, 8), 16) % 1000000).padStart(6, "0");
const phone = await graph(`${WHATSAPP_PHONE_ID}?fields=verified_name,quality_rating,platform_type`);
console.log(`phone: platform=${phone.platform_type} quality=${phone.quality_rating}`);
if (phone.platform_type !== "CLOUD_API") {
  try {
    await graph(`${WHATSAPP_PHONE_ID}/register`, { method: "POST", body: { messaging_product: "whatsapp", pin } });
    await botRef.set({ registrationPin: pin }, { merge: true });
    console.log("phone registered");
  } catch (e) {
    console.log(`phone registration: ${e.message}`);
  }
}

// 2. webhook: Meta תשלח כל הודעה שמגיעה למספר המועדון לבוט
const callback = `${WORKER_URL}/webhook`;
await graph(`${META_APP_ID}/subscriptions`, {
  method: "POST",
  token: `${META_APP_ID}|${META_APP_SECRET}`,
  body: { object: "whatsapp_business_account", callback_url: callback, verify_token: derive("webhook"), fields: "messages" },
});
await graph(`${WHATSAPP_WABA_ID}/subscribed_apps`, { method: "POST" });
console.log("webhook connected");

// 3. תבניות
const existing = await graph(`${WHATSAPP_WABA_ID}/message_templates?fields=name,status,language&limit=200`);
const have = new Map((existing.data || []).filter((t) => t.language === "he").map((t) => [t.name, t.status]));
for (const [name, t] of Object.entries(TEMPLATES)) {
  if (have.has(name)) {
    console.log(`template ${name}: ${have.get(name)}`);
    continue;
  }
  try {
    const r = await graph(`${WHATSAPP_WABA_ID}/message_templates`, {
      method: "POST",
      body: {
        name,
        language: "he",
        category: t.category,
        components: [{ type: "BODY", text: t.body, example: { body_text: [t.example] } }],
      },
    });
    console.log(`template ${name}: submitted (${r.status})`);
  } catch (e) {
    console.log(`template ${name}: ${e.message}`);
  }
}

// 4. כתובת הבוט למפקח
await botRef.set({ workerUrl: WORKER_URL, setupAt: new Date().toISOString() }, { merge: true });
console.log("done");
