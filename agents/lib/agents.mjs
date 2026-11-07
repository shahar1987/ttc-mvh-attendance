// הסוכנים שאפשר לבקש להריץ עכשיו (agentReports/bot.requests). הבוט כותב בקשה, ושני צרכנים לוקחים אותה:
// worker/src/dispatch.js (מפעיל את agents.yml מיד) ו-agents/requests.mjs (בדיקת ה-10 דקות ב-GitHub).
// השם חייב להיות אחת האפשרויות של input agent ב-.github/workflows/agents.yml.

// מה שהבעלים יכול לבקש מהבוט (run_agent_now)
export const OWNER_RUNNABLE = {
  scan: "הסורק היומי (דוח הבוקר)",
  bugcheck: "בודק הבאגים",
  ideas: "סוכן הרעיונות",
  supervisor: "המפקח",
  content: "סוכן הפרסום",
};
// ועוד autosend, שהבוט מבקש בעצמו כשהבעלים מאשר את השליחה להורים (inbox.js)
export const RUNNABLE = new Set([...Object.keys(OWNER_RUNNABLE), "autosend"]);
