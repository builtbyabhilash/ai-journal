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

const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";

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

  let aiResult;
  try {
    aiResult = await env.AI.run(AI_MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: entry },
      ],
    });
  } catch (err) {
    return jsonResponse({ error: "Couldn't reach the AI service.", detail: String(err) }, 502);
  }

  const text = aiResult?.response ?? "";

  let parsed;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    parsed = { raw: text };
  }

  return jsonResponse(parsed, 200);
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
