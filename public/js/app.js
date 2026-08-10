const entryText = document.getElementById("entryText");
const micBtn = document.getElementById("micBtn");
const micStatus = document.getElementById("micStatus");
const analyzeBtn = document.getElementById("analyzeBtn");
const insightsBody = document.getElementById("insightsBody");

setupSpeech();
analyzeBtn.addEventListener("click", analyzeEntry);

function setupSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.disabled = true;
    micStatus.textContent = "Voice input isn't supported in this browser — try Chrome or Edge.";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  let recording = false;
  let baseText = "";

  recognition.addEventListener("result", (event) => {
    let finalTranscript = "";
    let interimTranscript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }
    if (finalTranscript) {
      baseText = joinText(baseText, finalTranscript);
    }
    entryText.value = joinText(baseText, interimTranscript);
  });

  recognition.addEventListener("end", () => {
    recording = false;
    micBtn.classList.remove("recording");
    micStatus.textContent = "";
  });

  recognition.addEventListener("error", (event) => {
    recording = false;
    micBtn.classList.remove("recording");
    micStatus.textContent = `Mic error: ${event.error}`;
  });

  micBtn.addEventListener("click", () => {
    if (recording) {
      recognition.stop();
      return;
    }
    baseText = entryText.value;
    recording = true;
    micBtn.classList.add("recording");
    micStatus.textContent = "Listening…";
    recognition.start();
  });
}

function joinText(base, addition) {
  if (!addition) return base;
  const trimmedBase = base.trimEnd();
  if (!trimmedBase) return addition;
  return `${trimmedBase} ${addition}`;
}

async function analyzeEntry() {
  const entry = entryText.value.trim();
  if (!entry) {
    entryText.focus();
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Reflecting…";
  insightsBody.innerHTML = `<p class="loading">Reading through your entry…</p>`;

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entry }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    renderInsights(data);
  } catch (err) {
    insightsBody.innerHTML = `<p class="error-state">Couldn't get a reflection: ${escapeHtml(err.message)}</p>`;
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze my day";
  }
}

function renderInsights(data) {
  if (data.raw) {
    insightsBody.innerHTML = `<div class="insight-note">${escapeHtml(data.raw)}</div>`;
    return;
  }

  const wentWell = Array.isArray(data.wentWell) ? data.wentWell : [];
  const couldImprove = Array.isArray(data.couldImprove) ? data.couldImprove : [];
  const note = typeof data.encouragingNote === "string" ? data.encouragingNote : "";

  let html = "";
  if (note) {
    html += `<div class="insight-note">${escapeHtml(note)}</div>`;
  }

  html += `<div class="insight-section good"><h3>What went well</h3>`;
  html += wentWell.length
    ? `<ul class="insight-list">${wentWell.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p class="empty-state">Nothing specific stood out — try adding a bit more detail next time.</p>`;
  html += `</div>`;

  html += `<div class="insight-section improve"><h3>What you could improve</h3>`;
  html += couldImprove.length
    ? `<ul class="insight-list">${couldImprove
        .map(
          (item) =>
            `<li>${escapeHtml(item.point || "")}${
              item.how ? `<span class="how">Try: ${escapeHtml(item.how)}</span>` : ""
            }</li>`
        )
        .join("")}</ul>`
    : `<p class="empty-state">No specific suggestions this time.</p>`;
  html += `</div>`;

  insightsBody.innerHTML = html;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
