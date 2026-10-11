// קריאה אחת ל-Gemini (המפתח החינמי שקיים ב-GitHub). json=true מחזיר אובייקט מפוענח, אחרת טקסט.
export async function gemini(system, user, { json = false, temperature = 0.8 } = {}) {
  let err;
  for (const model of ["gemini-flash-latest", "gemini-flash-lite-latest"]) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature, ...(json && { responseMimeType: "application/json" }) },
      }),
    });
    if (r.ok) {
      const text = (await r.json()).candidates[0].content.parts.map((p) => p.text || "").join("").trim();
      return json ? JSON.parse(text) : text;
    }
    err = new Error(`${model}: ${r.status}`);
  }
  throw err;
}
