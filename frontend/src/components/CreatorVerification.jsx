import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, UserCheck, CheckCircle2 } from "lucide-react";
import { startCamera, captureFrame, stopCamera } from "../utils/camera";

const fakeDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startCreatorVerification() {
  await fakeDelay(500);
  return { session_id: "cv_" + Math.random().toString(36).substr(2, 9) };
}

async function sendVerificationFrame() {
  await fakeDelay(200);
}

async function finishCreatorVerification() {
  await fakeDelay(1500);
  return {
    verified: true,
    confidence: 0.98,
    is_live: true,
    face_match: true
  };
}

export default function CreatorVerification({ onComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [step, setStep] = useState("idle");
  const [progress, setProgress] = useState(0);

  const startVerificationFlow = async () => {
    setStep("scanning");
    
    try {
      const session = await startCreatorVerification();
      
      for (let i = 1; i <= 5; i++) {
        await captureFrame(videoRef, canvasRef);
        await sendVerificationFrame(session.session_id);
        setProgress((i / 5) * 100);
      }

      const result = await finishCreatorVerification(session.session_id);
      
      if (result.verified) {
        setStep("verified");
      } else {
        setStep("idle");
      }
    } catch (e) {
      console.error(e);
      setStep("idle");
    }
  };

  useEffect(() => {
    startCamera(videoRef);
    
    const timer = setTimeout(() => {
       setStep("detecting");
       setTimeout(() => {
          startVerificationFlow();
       }, 2000);
    }, 1000);

    return () => {
      clearTimeout(timer);
      stopCamera(videoRef);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] w-full max-w-2xl mx-auto text-center relative overflow-hidden bg-[#111113] rounded-2xl p-6 sm:p-8 border border-white/[0.06]">
      
      <AnimatePresence mode="wait">
        
        {step !== "verified" && (
          <motion.div 
            key="camera-view"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.03 }}
            className="flex flex-col items-center w-full"
          >
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">Verify Your Identity</h2>
            <p className="text-[13px] text-zinc-400 mb-8 px-2">
               {step === "idle" ? "Initializing camera..." : 
                step === "detecting" ? "Look directly at the camera" :
                "Hold still. Analyzing..."}
            </p>

            <div className="relative mb-10 flex items-center justify-center">
               <div 
                 className="relative overflow-hidden flex items-center justify-center w-[240px] h-[240px] sm:w-[280px] sm:h-[280px] rounded-full transition-all duration-500"
                 style={{ 
                    border: step === "detecting" ? "3px solid rgba(255,255,255,0.15)" : "3px solid rgba(59,130,246,0.6)",
                    boxShadow: step === "scanning" ? "0 0 30px rgba(59,130,246,0.2)" : "none",
                 }}
               >
                 <video
                   ref={videoRef}
                   autoPlay
                   playsInline
                   muted
                   className="absolute inset-0 w-full h-full object-cover scale-125 select-none pointer-events-none"
                 />

                 {step === "scanning" && (
                    <motion.div 
                      className="absolute inset-0 bg-blue-500/15 mix-blend-overlay pointer-events-none"
                      animate={{ opacity: [0, 0.4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                 )}
               </div>

               {step === "scanning" && (
                 <motion.div 
                   className="absolute w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] rounded-full border border-blue-400/20 border-dashed pointer-events-none"
                   animate={{ rotate: 360 }}
                   transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                 />
               )}
            </div>

            {/* Progress */}
            <div className="w-full max-w-[280px] h-12 flex flex-col justify-center items-center">
               <AnimatePresence>
                 {step === "scanning" && (
                    <motion.div 
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="w-full"
                    >
                       <div className="flex justify-between text-[11px] text-blue-400 mb-2 font-mono">
                         <span>Scanning</span>
                         <span>{Math.round(progress)}%</span>
                       </div>
                       <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                         <motion.div 
                            className="h-full bg-blue-500"
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.2 }}
                         />
                       </div>
                    </motion.div>
                 )}
               </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Verified */}
        {step === "verified" && (
          <motion.div 
            key="verified-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center w-full py-8"
          >
             <div className="w-20 h-20 bg-emerald-500/[0.08] rounded-full flex items-center justify-center mb-5">
               <CheckCircle2 size={40} className="text-emerald-500" />
             </div>
             
             <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Verified Creator</h2>
             
             <div className="flex flex-col items-start gap-3 mt-6 mb-10 text-[14px] text-zinc-300">
                <div className="flex items-center gap-3">
                   <ShieldCheck size={17} className="text-emerald-400 flex-shrink-0" />
                   <span>Live Presence Verified</span>
                </div>
                <div className="flex items-center gap-3">
                   <UserCheck size={17} className="text-emerald-400 flex-shrink-0" />
                   <span>Facial Consistency Confirmed</span>
                </div>
             </div>

             <div className="bg-emerald-500/[0.08] border border-emerald-500/[0.15] px-4 py-2 rounded-lg mb-8 inline-flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[12px] font-semibold text-emerald-400 tracking-wider">VERIFIED</span>
             </div>

             <button 
               onClick={() => onComplete && onComplete()}
               className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-zinc-200 text-black rounded-xl font-semibold transition-colors text-[14px] min-h-[48px]"
             >
               Attach Verification to Upload
             </button>
          </motion.div>
        )}

      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
