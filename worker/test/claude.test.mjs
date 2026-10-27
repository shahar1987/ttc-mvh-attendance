import assert from "node:assert/strict";
import { toClaude, fromClaude } from "../src/claude.js";

const req = toClaude({
  systemInstruction: { parts: [{ text: "sys" }] },
  contents: [
    { role: "user", parts: [{ text: "מי הגיע?" }, { inlineData: { mimeType: "image/jpeg", data: "AA" } }] },
    { role: "model", parts: [{ functionCall: { name: "attendance", args: { g: 1 } } }, { functionCall: { name: "groups", args: {} } }] },
    { role: "user", parts: [{ functionResponse: { name: "groups", response: { result: "x" } } }, { functionResponse: { name: "attendance", response: { result: "y" } } }] },
    { role: "user", parts: [{ text: "" }, { text: "ועוד" }] },
  ],
  tools: [{ functionDeclarations: [{ name: "attendance", description: "d", parameters: { type: "object", properties: {} } }, { name: "groups", description: "d" }] }],
  toolConfig: { functionCallingConfig: { mode: "NONE" } },
  generationConfig: { maxOutputTokens: 500, temperature: 1.2 },
});
assert.equal(req.system, "sys");
assert.equal(req.max_tokens, 1024); // רצפה: חשיבה לא בולעת את כל התקציב
assert.equal(toClaude({ contents: [], generationConfig: { maxOutputTokens: 4096 } }).max_tokens, 4096);
assert.equal("temperature" in req, false); // Haiku 5.5 דוחה temperature
assert.deepEqual(req.tool_choice, { type: "none" });
assert.deepEqual(req.messages.map((m) => m.role), ["user", "assistant", "user"]); // תורות user רצופות מתאחדות
assert.equal(req.messages[0].content[1].type, "image");
const [a, b] = req.messages[1].content;
const [ra, rb] = req.messages[2].content;
assert.equal(ra.tool_use_id, b.id); // groups נענה ראשון — מזוהה לפי שם, לא לפי סדר
assert.equal(rb.tool_use_id, a.id);
assert.equal(req.messages[2].content.at(-1).text, "ועוד");
assert.deepEqual(req.tools[1].input_schema, { type: "object", properties: {} });

const parts = fromClaude({ content: [{ type: "text", text: "היי" }, { type: "tool_use", id: "1", name: "groups", input: { a: 1 } }], stop_reason: "tool_use" });
assert.deepEqual([...parts], [{ text: "היי" }, { functionCall: { name: "groups", args: { a: 1 } } }]);
assert.equal(parts.finishReason, "STOP");
assert.equal(fromClaude({ content: [], stop_reason: "max_tokens" }).finishReason, "MAX_TOKENS");
console.log("claude fallback ok");
