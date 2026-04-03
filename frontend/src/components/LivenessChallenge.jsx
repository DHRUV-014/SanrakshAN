import { useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ShieldCheck, Zap, CheckCircle2, Loader2, AlertCircle } from "lucide-react"

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
      await new Promise(r => setTimeout(r, 500))
    }

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

  const isLive = result?.verdict?.toLowerCase().includes("live")

  return (
    <div className="w-full">
      {/* Video feed */}
      <div className="w-full max-w-md mx-auto mb-5">
        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${cameraReady ? '' : 'hidden'}`}
          />

          {/* Idle state */}
          {!cameraReady && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 gap-2 z-10">
              <ShieldCheck size={28} className="text-gray-300" />
              <p className="text-gray-400 text-[12px] text-center px-4">
                Click "Start Liveness Test" to begin
              </p>
            </div>
          )}

          {/* Error state */}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 gap-3 z-10 px-6">
              <AlertCircle size={28} className="text-red-400" />
              {permDenied ? (
                <>
                  <p className="text-gray-700 text-[13px] font-medium text-center">
                    Camera permission was blocked
                  </p>
                  <p className="text-gray-500 text-[11px] text-center leading-relaxed">
                    Click the lock icon in your browser's address bar → Set Camera to "Allow" → Reload the page
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gray-700 text-[13px] font-medium text-center">
                    Could not access camera
                  </p>
                  <button
                    onClick={runChallenge}
                    className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[12px] font-semibold transition-colors"
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

      {/* CTA button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={runChallenge}
          disabled={running}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[13px] font-semibold transition-all duration-200 min-h-[48px] w-full sm:w-auto max-w-xs
            ${running
              ? "bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md"
            }`}
        >
          {running ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Running analysis…
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
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
              <h3 className="text-[11px] font-semibold text-gray-400 flex items-center gap-2 tracking-widest uppercase">
                <CheckCircle2 size={13} className="text-green-500" />
                Result
              </h3>

              <div className="grid grid-cols-3 gap-3 w-full">
                {[
                  { label: "Baseline", value: Number(result.baseline_red_mean).toFixed(2) },
                  { label: "Flash", value: Number(result.flash_red_mean).toFixed(2) },
                  { label: "Delta", value: Number(result.delta_intensity).toFixed(2) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex flex-col items-center">
                    <p className="text-[10px] text-gray-400 uppercase font-medium mb-1">{label}</p>
                    <p className="text-[15px] font-semibold text-gray-900 font-mono">{value}</p>
                  </div>
                ))}
              </div>

              <div className={`px-4 py-3 rounded-lg border text-[13px] font-semibold text-center flex items-center justify-center gap-2 ${
                isLive
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}>
                {isLive ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {result.verdict}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
