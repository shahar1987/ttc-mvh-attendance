// תקלה זמנית של Google (429/5xx, ניתוק רשת) לא צריכה להכשיל את הריצה: מנסים שוב,
// ואם היא נמשכת — מסיימים בירוק עם אזהרה, כי הריצה הבאה (כל שעה) משלימה את אותו עדכון.
// תקלה אמיתית (הרשאה, נתונים חסרים, באג) ממשיכה להכשיל ולהתריע.
const NETWORK = /fetch failed|ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket hang up/;

export function isTransient(err) {
  const status = err?.status ?? err?.response?.status;
  return status === 429 || status >= 500 || [4, 14].includes(err?.code) || NETWORK.test(String(err?.message || err));
}

export async function fetchRetry(url, init, label, delays = [2000, 5000, 15000]) {
  for (let i = 0; ; i++) {
    let err;
    try {
      const r = await fetch(url, init);
      if (r.ok) return r;
      err = Object.assign(new Error(`${label} failed (${r.status})`), { status: r.status });
    } catch (e) {
      err = e;
    }
    if (i >= delays.length || !isTransient(err)) throw err;
    await new Promise((done) => setTimeout(done, delays[i]));
  }
}

export function finish(name, err) {
  const msg = err?.message || err;
  if (isTransient(err)) {
    console.log(`::warning::${name}: temporary failure, the next hourly run will retry: ${msg}`);
    process.exit(0);
  }
  console.error(`${name} failed: ${msg}`);
  process.exit(1);
}
