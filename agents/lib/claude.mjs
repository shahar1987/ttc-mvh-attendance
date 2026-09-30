// קריאה אחת ל-Claude, לסוכנים המתוזמנים (רעיונות). הבוט עצמו ב-worker/src/claude.js.
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";

export async function ask(system, user, { effort = "medium", max_tokens = 16000 } = {}) {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens,
    thinking: { type: "adaptive" },
    output_config: { effort },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined the request");
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
