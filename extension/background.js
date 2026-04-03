/**
 * SanrakshAN Audio Shield — Background Service Worker (MV3)
 *
 * Flow:
 *   popup → "START_MONITORING" message
 *     → tabCapture.capture() on the active tab
 *     → MediaRecorder records 2-second chunks (audio/webm;codecs=opus)
 *     → each chunk is POSTed to POST /analyze-audio
 *     → result updates the badge (🟢 / 🔴) and is broadcast to popup
 *   popup → "STOP_MONITORING" message
 *     → stops recorder + stream
 */

const API_BASE = "https://sanrakshan-api.onrender.com"; // change for local: http://localhost:8000
const CHUNK_MS = 2500;   // record in 2.5-second windows
const FAKE_THRESHOLD = 0.60; // confidence above which we flag as deepfake

// ── State ────────────────────────────────────────────────────────────────────
let recorder = null;
let stream   = null;
let monitoring = false;

// ── Badge helpers ─────────────────────────────────────────────────────────────

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

function clearBadge() {
  chrome.action.setBadgeText({ text: "" });
}

// ── Broadcast to any open popup ───────────────────────────────────────────────

function broadcast(payload) {
  chrome.runtime.sendMessage(payload).catch(() => {
    // popup may be closed — silence the error
  });
}

// ── Audio capture + analysis loop ────────────────────────────────────────────

async function startMonitoring(tabId) {
  if (monitoring) return;

  // tabCapture must be called directly from a user-gesture context in MV3.
  // The popup triggers this via message; the gesture chain is preserved.
  stream = await new Promise((resolve, reject) => {
    chrome.tabCapture.capture(
      { audio: true, video: false },
      (s) => {
        if (chrome.runtime.lastError || !s) {
          reject(new Error(chrome.runtime.lastError?.message || "tabCapture failed"));
        } else {
          resolve(s);
        }
      }
    );
  });

  monitoring = true;
  broadcast({ type: "STATUS", monitoring: true });
  setBadge("…", "#9333ea");

  // We need a MediaRecorder that produces blobs we can send as a file.
  // audio/webm;codecs=opus is universally supported in Chromium.
  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";

  recorder = new MediaRecorder(stream, { mimeType });

  recorder.ondataavailable = async (e) => {
    if (!e.data || e.data.size === 0) return;
    await analyzeChunk(e.data, mimeType);
  };

  // Request a chunk every CHUNK_MS milliseconds
  recorder.start(CHUNK_MS);
}

async function analyzeChunk(blob, mimeType) {
  try {
    const ext = mimeType.startsWith("audio/webm") ? ".webm" : ".ogg";
    const form = new FormData();
    form.append("file", blob, `chunk${ext}`);

    const res = await fetch(`${API_BASE}/analyze-audio`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      console.warn("[SanrakshAN] API error:", res.status);
      return;
    }

    const data = await res.json();
    // data = { label, confidence, method, processing_time }

    const isFake = data.label === "FAKE" && data.confidence >= FAKE_THRESHOLD;

    if (isFake) {
      setBadge("!", "#ef4444");   // red
    } else {
      setBadge("✓", "#22c55e");   // green
    }

    broadcast({ type: "RESULT", ...data, flagged: isFake });

  } catch (err) {
    console.error("[SanrakshAN] chunk analysis failed:", err);
    setBadge("?", "#f59e0b");
  }
}

function stopMonitoring() {
  if (recorder && recorder.state !== "inactive") {
    recorder.stop();
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }
  recorder  = null;
  stream    = null;
  monitoring = false;

  clearBadge();
  broadcast({ type: "STATUS", monitoring: false });
}

// ── Message handler (from popup) ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "START_MONITORING") {
    startMonitoring(msg.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("[SanrakshAN]", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true; // keep channel open for async response
  }

  if (msg.type === "STOP_MONITORING") {
    stopMonitoring();
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "GET_STATUS") {
    sendResponse({ monitoring });
    return false;
  }
});
