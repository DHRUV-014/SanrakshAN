import { useRef, useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ShieldCheck, Zap, CheckCircle2, Loader2 } from "lucide-react"

import { startCamera, captureFrame } from "../utils/camera"

import {
  startChallengeSession,
  sendFrame,
  analyzeChallenge
} from "../services/challengeAPI"


export default function LivenessChallenge() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const [permDenied, setPermDenied] = useState(false)

  function flashScreen() {
    const overlay = document.createElement("div")
    overlay.style.position = "fixed"
    overlay.style.top = 0
    overlay.style.left = 0
    overlay.style.width = "100%"
    overlay.style.height = "100%"
    overlay.style.background = "red"
    overlay.style.zIndex = 9999
    document.body.appendChild(overlay)
    setTimeout(() => {
      document.body.removeChild(overlay)
    }, 200)
  }

  async function runChallenge() {
    setCameraError(false)
    setPermDenied(false)
    setRunning(true)
    setResult(null)

    // Step 1: Request camera access (triggers browser permission popup)
    if (!cameraReady) {
      try {
        await startCamera(videoRef)
        setCameraReady(true)
      } catch (err) {
        console.error("Camera access failed:", err.name, err.message)
        setCameraError(true)
        if (err.name === "NotAllowedError") {
          setPermDenied(true)
        }
        setRunning(false)
        return
      }
      // Small delay to let the video feed stabilize
      await new Promise(r => setTimeout(r, 500))
    }

    // Step 2: Run the liveness challenge
    try {
      const session = await startChallengeSession()
      const sessionId = session.session_id

      for (let i = 0; i < 3; i++) {
        const frame = await captureFrame(videoRef, canvasRef)
        await sendFrame(sessionId, frame)
        await new Promise(r => setTimeout(r, 200))
      }

      flashScreen()
      await new Promise(r => setTimeout(r, 250))

      for (let i = 0; i < 4; i++) {
        const frame = await captureFrame(videoRef, canvasRef)
        await sendFrame(sessionId, frame)
        await new Promise(r => setTimeout(r, 200))
      }

      const analysis = await analyzeChallenge(sessionId)
      setResult(analysis)
    } catch (err) {
      console.error(err)
    }

    setRunning(false)
  }

  return (
    <div className="w-full">
      <h2 className="text-[15px] font-semibold text-white mb-5 flex items-center gap-2">
        <ShieldCheck size={18} className="text-blue-400 flex-shrink-0" />
        Liveness Verification
      </h2>

      {/* Video */}
      <div className="w-full max-w-md mx-auto mb-5">
        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black border border-white/[0.06]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${cameraReady ? '' : 'hidden'}`}
          />

          {/* Idle state — camera not started yet */}
          {!cameraReady && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#09090b] gap-2 z-10">
              <ShieldCheck size={28} className="text-zinc-700" />
              <p className="text-zinc-500 text-[12px] text-center px-4">
                Click "Start Liveness Test" to begin
              </p>
            </div>
          )}

          {/* Error state */}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#09090b] gap-3 z-10">
              <ShieldCheck size={28} className="text-zinc-600" />
              {permDenied ? (
                <>
                  <p className="text-zinc-400 text-[13px] font-medium text-center px-4">
                    Camera permission was blocked
                  </p>
                  <p className="text-zinc-600 text-[11px] text-center px-6 leading-relaxed">
                    Click the 🔒 lock icon in your browser's address bar → Set Camera to "Allow" → Reload the page
                  </p>
                </>
              ) : (
                <>
                  <p className="text-zinc-400 text-[13px] font-medium text-center px-4">
                    Could not access camera
                  </p>
                  <button
                    onClick={runChallenge}
                    className="mt-2 px-5 py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-[12px] font-semibold transition-colors"
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Button */}
      <div className="flex justify-center mb-5">
        <button
          onClick={runChallenge}
          disabled={running}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[13px] font-semibold transition-all duration-200 min-h-[48px] w-full sm:w-auto max-w-xs
            ${running
              ? "bg-white/[0.04] border border-white/[0.06] text-zinc-500 cursor-not-allowed"
              : "bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            }`}
        >
          {running ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Zap size={15} />
              Start Liveness Test
            </>
          )}
        </button>
      </div>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full max-w-md mx-auto"
          >
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
              <h3 className="text-[12px] font-semibold text-zinc-400 flex items-center gap-2 tracking-wider mb-3">
                <CheckCircle2 size={13} className="text-emerald-500" />
                RESULT
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 min-w-0 flex-1 flex flex-col items-center justify-center">
                  <p className="text-xs text-zinc-400 uppercase font-medium mb-1 truncate w-full text-center">Baseline</p>
                  <p className="text-lg font-semibold tracking-tight text-white font-mono truncate w-full text-center">
                    {Number(result.baseline_red_mean).toFixed(2)}
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 min-w-0 flex-1 flex flex-col items-center justify-center">
                  <p className="text-xs text-zinc-400 uppercase font-medium mb-1 truncate w-full text-center">Flash</p>
                  <p className="text-lg font-semibold tracking-tight text-white font-mono truncate w-full text-center">
                    {Number(result.flash_red_mean).toFixed(2)}
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 min-w-0 flex-1 flex flex-col items-center justify-center">
                  <p className="text-xs text-zinc-400 uppercase font-medium mb-1 truncate w-full text-center">Delta</p>
                  <p className="text-lg font-semibold tracking-tight text-white font-mono truncate w-full text-center">
                    {Number(result.delta_intensity).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className={`mt-3 px-4 py-3 rounded-lg border text-[13px] font-semibold text-center min-h-[44px] flex items-center justify-center
                ${result.verdict?.toLowerCase().includes("live")
                  ? "bg-emerald-500/[0.08] border-emerald-500/[0.2] text-emerald-400"
                  : "bg-red-500/[0.08] border-red-500/[0.2] text-red-400"
                }`}
              >
                {result.verdict}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}