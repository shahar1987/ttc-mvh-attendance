// גיבוי ל-Gemini: כשגוגל חוסם (403 תקרת הוצאה, 429 מכסה) — אותה בקשה הולכת ל-Claude Haiku.
// מתרגם בקשה בפורמט Gemini ל-Anthropic Messages ומחזיר parts בפורמט Gemini, כך שהקוראים לא משתנים.
export const CLAUDE_MODEL = "claude-haiku-5-5";

export function toClaude(body) {
  const ids = []; // tool_use שעוד לא נענו, לפי סדר — functionResponse של Gemini מזוהה רק בשם
  let n = 0;
  const block = (p) => {
    if (p.text) return { type: "text", text: p.text };
    if (p.functionCall) {
      const id = `t${n++}`;
      ids.push({ id, name: p.functionCall.name });
      return { type: "tool_use", id, name: p.functionCall.name, input: p.functionCall.args || {} };
    }
    if (p.functionResponse) {
      const i = ids.findIndex((x) => x.name === p.functionResponse.name);
      const [{ id }] = ids.splice(i < 0 ? 0 : i, 1);
      return { type: "tool_result", tool_use_id: id, content: JSON.stringify(p.functionResponse.response ?? {}) };
    }
    const d = p.inlineData;
    if (d?.mimeType?.startsWith("image/")) return { type: "image", source: { type: "base64", media_type: d.mimeType, data: d.data } };
    if (d?.mimeType === "application/pdf") return { type: "document", source: { type: "base64", media_type: d.mimeType, data: d.data } };
    if (d) return { type: "text", text: `[קובץ ${d.mimeType} — לא נתמך כרגע]` }; // shortcut: Claude לא מקבל שמע; הודעות קוליות לא יתומללו בזמן הגיבוי
    return null;
  };
  const messages = [];
  for (const c of body.contents || []) {
    const role = c.role === "model" ? "assistant" : "user";
    const content = (c.parts || []).map(block).filter(Boolean);
    if (!content.length) continue;
    const prev = messages.at(-1);
    if (prev?.role === role) prev.content.push(...content);
    else messages.push({ role, content });
  }
  const decls = (body.tools || []).flatMap((t) => t.functionDeclarations || []);
  const g = body.generationConfig || {};
  return {
    model: CLAUDE_MODEL,
    // Haiku 5.5 חושב לפני שעונה; בתקציב קטן (200) החשיבה אוכלת הכל והתשובה יוצאת ריקה (נבדק 2026-10-27)
    max_tokens: Math.max(g.maxOutputTokens || 2048, 1024),
    // בלי temperature: Haiku 5.5 מחזיר 400 "temperature is deprecated for this model" (2026-10-25)
    ...(body.systemInstruction && { system: body.systemInstruction.parts.map((p) => p.text).join("\n") }),
    messages,
    ...(decls.length && { tools: decls.map(({ name, description, parameters }) => ({ name, description, input_schema: parameters || { type: "object", properties: {} } })) }),
    ...(decls.length && body.toolConfig?.functionCallingConfig?.mode === "NONE" && { tool_choice: { type: "none" } }),
  };
}

export function fromClaude(res) {
  const parts = (res.content || []).flatMap((b) =>
    b.type === "text" && b.text ? [{ text: b.text }] : b.type === "tool_use" ? [{ functionCall: { name: b.name, args: b.input } }] : []);
  parts.finishReason = res.stop_reason === "max_tokens" ? "MAX_TOKENS" : "STOP";
  return parts;
}

export async function claude(env, body, trace = []) {
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(toClaude(body)),
    signal: AbortSignal.timeout(Number(env.GEMINI_TIMEOUT_MS) || 40000),
  }).catch((e) => ({ ok: false, status: e.name === "TimeoutError" ? "timeout" : e.message }));
  trace.push(`${CLAUDE_MODEL} ${Math.round((Date.now() - t0) / 1000)}s ${r.status}`);
  if (!r.ok) {
    const why = r.json ? (await r.json().catch(() => null))?.error?.message : "";
    throw new Error(`גם Claude לא זמין (${r.status}${why ? `: ${String(why).slice(0, 120)}` : ""})`);
  }
  const parts = fromClaude(await r.json());
  // תשובה ריקה (נגמר התקציב/סירוב) — זורקים, כדי ש-Gemini יענה במקום "נסה שוב"
  if (!parts.length) throw new Error(`Claude החזיר תשובה ריקה (${parts.finishReason})`);
  return parts;
}
