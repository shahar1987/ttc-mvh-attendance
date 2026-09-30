// Firestore דרך REST, עם אותו service account של הסוכנים (ב-Worker אין firebase-admin).
// ה-service account עוקף את חוקי Firestore — לכן הבוט נוגע רק במה שכתוב כאן.

let cached = { token: "", exp: 0 };

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlText = (s) => b64url(new TextEncoder().encode(s));

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (cached.token && cached.exp - 60 > now) return cached.token;
  const header = b64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64urlText(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${header}.${claims}.${b64url(sig)}`,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Google auth failed: ${j.error_description || res.status}`);
  cached = { token: j.access_token, exp: now + j.expires_in };
  return cached.token;
}

export function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
}

export function fromValue(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return fromFields(v.mapValue.fields);
  return null;
}
const fromFields = (f = {}) => Object.fromEntries(Object.entries(f).map(([k, x]) => [k, fromValue(x)]));
const docOut = (d) => ({ id: d.name.split("/").pop(), ...fromFields(d.fields) });

export function db(env) {
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  const call = async (url, init = {}) => {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${await accessToken(sa)}`, "Content-Type": "application/json" },
    });
    if (res.status === 404) return null;
    const j = await res.json();
    if (!res.ok) throw new Error(`Firestore ${res.status}: ${j.error?.message || ""}`);
    return j;
  };
  return {
    async get(path) {
      const j = await call(`${base}/${path}`);
      return j ? docOut(j) : null;
    },
    // מיזוג: מעדכן רק את השדות שנשלחו (כמו setDoc עם merge באפליקציה)
    async merge(path, data) {
      const mask = Object.keys(data)
        .map((k) => `updateMask.fieldPaths=${encodeURIComponent("`" + k + "`")}`)
        .join("&");
      await call(`${base}/${path}?${mask}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) }),
      });
    },
    async list(collection) {
      const out = [];
      let token = "";
      do {
        const j = await call(`${base}/${collection}?pageSize=300${token ? `&pageToken=${token}` : ""}`);
        (j?.documents || []).forEach((d) => out.push(docOut(d)));
        token = j?.nextPageToken || "";
      } while (token);
      return out;
    },
    async where(collection, field, value) {
      const j = await call(`${base}:runQuery`, {
        method: "POST",
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: collection }],
            where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: toValue(value) } },
          },
        }),
      });
      return (j || []).filter((r) => r.document).map((r) => docOut(r.document));
    },
  };
}
