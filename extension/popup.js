/**
 * SanrakshAN Audio Shield — Popup controller
 *
 * Communicates with background.js via chrome.runtime.sendMessage.
 * Updates UI based on monitoring status and analysis results.
 */

const actionBtn      = document.getElementById("actionBtn");
const statusPill     = document.getElementById("statusPill");
const statusText     = document.getElementById("statusText");
const resultCard     = document.getElementById("resultCard");
const resultLabel    = document.getElementById("resultLabel");
const confidenceBar  = document.getElementById("confidenceBar");
const confidenceText = document.getElementById("confidenceText");
const methodText     = document.getElementById("methodText");
const alertBanner    = document.getElementById("alertBanner");
const alertIcon      = document.getElementById("alertIcon");
const alertText      = document.getElementById("alertText");

let isMonitoring = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

function setMonitoringUI(active) {
  isMonitoring = active;

  if (active) {
    statusPill.className = "status-pill active";
    statusText.textContent = "Monitoring";
    actionBtn.className = "btn stop";
    actionBtn.textContent = "Stop Monitoring";
  } else {
    statusPill.className = "status-pill idle";
    statusText.textContent = "Idle";
    actionBtn.className = "btn start";
    actionBtn.textContent = "Start Monitoring";
    resultCard.classList.remove("visible");
    alertBanner.classList.remove("visible");
  }
}

function showResult(data) {
  const isFake       = data.label === "FAKE";
  const confidencePct = Math.round((data.confidence || 0) * 100);

  resultLabel.textContent = data.label || "—";
  resultLabel.className   = `result-value ${isFake ? "fake" : "real"}`;

  confidenceBar.style.width = `${confidencePct}%`;
  confidenceBar.className   = `confidence-bar ${isFake ? "fake" : "real"}`;

  confidenceText.textContent = `${confidencePct}% confidence`;
  methodText.textContent     = data.method ? `via ${data.method}` : "";

  resultCard.classList.add("visible");

  // Alert banner
  if (data.flagged) {
    alertBanner.className = "alert visible fake";
    alertIcon.textContent = "⚠";
    alertText.textContent = "Possible synthetic audio detected";
  } else {
    alertBanner.className = "alert visible real";
    alertIcon.textContent = "✓";
    alertText.textContent = "Audio appears authentic";
  }
}

// ── Init — sync with background state ────────────────────────────────────────

chrome.runtime.sendMessage({ type: "GET_STATUS" }, (resp) => {
  if (resp) setMonitoringUI(resp.monitoring);
});

// ── Listen for results from background ───────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STATUS") {
    setMonitoringUI(msg.monitoring);
  }
  if (msg.type === "RESULT") {
    showResult(msg);
  }
});

// ── Button click ──────────────────────────────────────────────────────────────

actionBtn.addEventListener("click", async () => {
  actionBtn.disabled = true;

  if (!isMonitoring) {
    // Get active tab ID — needed by tabCapture
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      actionBtn.disabled = false;
      return;
    }

    chrome.runtime.sendMessage(
      { type: "START_MONITORING", tabId: tab.id },
      (resp) => {
        actionBtn.disabled = false;
        if (!resp?.ok) {
          alert(`Could not start monitoring: ${resp?.error || "unknown error"}`);
        }
      }
    );
  } else {
    chrome.runtime.sendMessage({ type: "STOP_MONITORING" }, () => {
      actionBtn.disabled = false;
    });
  }
});
