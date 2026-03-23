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

  useEffect(() => {
    startCamera(videoRef)
  }, [])

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
    setRunning(true)
    setResult(null)

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
            className="absolute inset-0 w-full h-full object-cover"
          />
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
                  <p className="text-[11px] text-zinc-500 font-medium mb-1">Baseline Red</p>
                  <p className="text-[14px] font-mono text-white">{result.baseline_red_mean}</p>
                </div>
                <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
                  <p className="text-[11px] text-zinc-500 font-medium mb-1">Flash Red</p>
                  <p className="text-[14px] font-mono text-white">{result.flash_red_mean}</p>
                </div>
                <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
                  <p className="text-[11px] text-zinc-500 font-medium mb-1">Delta</p>
                  <p className="text-[14px] font-mono text-white">{result.delta_intensity}</p>
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