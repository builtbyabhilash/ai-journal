const SYSTEM_PROMPT = `You are a thoughtful, kind journaling coach. The user will send you a raw journal entry describing their day.

Respond with ONLY a single valid JSON object, no markdown fences, no commentary, matching this shape:

{
  "encouragingNote": "one short, warm sentence acknowledging their day",
  "wentWell": ["specific thing they did well or should feel good about", "..."],
  "couldImprove": [
    { "point": "specific, concrete area to improve, grounded in what they wrote", "how": "one practical, small action they could try next time" }
  ]
}

Guidelines:
- Base everything strictly on what the user actually wrote. Do not invent details.
- Be specific, not generic — reference what they described.
- Keep "wentWell" and "couldImprove" to at most 4 items each.
- Tone: warm, honest, encouraging — like a supportive friend, not clinical or preachy.
- If the entry is very short or vague, it's fine to have fewer items, but still respond with valid JSON in the exact shape above.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/analyze" && request.method === "POST") {
      return handleAnalyze(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleAnalyze(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const entry = typeof body.entry === "string" ? body.entry.trim() : "";
  if (!entry) {
    return jsonResponse({ error: "No journal entry provided." }, 400);
  }

  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse(
      { error: "AI isn't configured yet — missing ANTHROPIC_API_KEY secret." },
      500
    );
  }

  let apiRes;
  try {
    apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: entry }],
      }),
    });
  } catch (err) {
    return jsonResponse({ error: "Couldn't reach the AI service.", detail: String(err) }, 502);
  }

  if (!apiRes.ok) {
    const detail = await apiRes.text();
    return jsonResponse({ error: "AI request failed.", detail }, 502);
  }

  const data = await apiRes.json();
  const text = data.content?.[0]?.text ?? "";

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  return jsonResponse(parsed, 200);
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
