const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

export async function startChallengeSession() {
  const res = await fetch(`${BASE_URL}/challenge/start`, {
    method: "POST"
  })

  return res.json()
}

export async function sendFrame(sessionId, blob) {
  const formData = new FormData()
  formData.append("file", blob, "frame.jpg")

  await fetch(`${BASE_URL}/challenge/frame/${sessionId}`, {
    method: "POST",
    body: formData
  })
}

export async function analyzeChallenge(sessionId) {
  const res = await fetch(`${BASE_URL}/challenge/analyze/${sessionId}`)
  return res.json()
}