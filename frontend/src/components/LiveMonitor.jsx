import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Crosshair, AlertTriangle, Activity } from "lucide-react";
import { startCamera, stopCamera } from "../utils/camera";

const MOCK_INTERVAL_MS = 1500;

export default function LiveMonitor() {
  const videoRef = useRef(null);
  
  const [status, setStatus] = useState("initializing");
  const [faceAuthentic, setFaceAuthentic] = useState(true);
  const [livenessCheck, setLivenessCheck] = useState(true);
  const [riskScore, setRiskScore] = useState(0);

  useEffect(() => {
    startCamera(videoRef);

    let isMounted = true;
    let timer;

    setTimeout(() => {
       if (!isMounted) return;
       setStatus("authentic");
       
       timer = setInterval(() => {
          if (!isMounted) return;
          
          const isSuspicious = Math.random() > 0.8;
          
          if (isSuspicious) {
             setStatus("suspicious");
             setFaceAuthentic(false);
             setLivenessCheck(Math.random() > 0.5);
             setRiskScore(Math.floor(Math.random() * 20) + 75);
             
             setTimeout(() => {
                if (!isMounted) return;
                setStatus("authentic");
                setFaceAuthentic(true);
                setLivenessCheck(true);
                setRiskScore(Math.floor(Math.random() * 5));
             }, 4000);
          } else if (status === "authentic") {
             setRiskScore(Math.floor(Math.random() * 5));
          }
       }, MOCK_INTERVAL_MS);

    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(timer);
      stopCamera(videoRef);
    };
  }, [status]);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row gap-5 p-2 sm:p-4">
       
       {/* Video */}
       <div className="relative flex-1 bg-black rounded-2xl border border-white/[0.06] overflow-hidden flex items-center justify-center min-h-[300px] sm:min-h-[380px]">
          <video
             ref={videoRef}
             autoPlay
             playsInline
             muted
             className={`w-full h-full object-cover transition-all duration-300 scale-105 ${status === "suspicious" ? "blur-[2px] grayscale-[40%]" : ""}`}
          />

          {/* Authentic overlay */}
          {status === "authentic" && (
             <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-4 left-4 flex items-center gap-2 px-2.5 py-1 bg-black/40 backdrop-blur-md rounded-md border border-emerald-500/20 text-emerald-400 font-mono text-[11px]">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   SECURE
                </div>

                <motion.div 
                   animate={{ scale: [0.98, 1.02, 0.98], opacity: [0.3, 0.6, 0.3] }}
                   transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                   className="absolute left-[25%] top-[15%] w-[50%] h-[55%] border-2 border-emerald-500/30 rounded-xl"
                >
                   <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-400/60" />
                   <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-emerald-400/60" />
                   <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-emerald-400/60" />
                   <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-400/60" />
                </motion.div>
             </div>
          )}

          {/* Suspicious overlay */}
          <AnimatePresence>
             {status === "suspicious" && (
                <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="absolute inset-0 pointer-events-none border-4 border-red-500/40 z-10 flex items-center justify-center bg-red-900/10"
                >
                   <div className="absolute top-4 left-4 px-2.5 py-1 bg-red-500/15 backdrop-blur-md rounded-md border border-red-500/40 flex items-center gap-2">
                       <AlertTriangle size={13} className="text-red-400" />
                       <span className="text-red-300 font-mono text-[11px] font-semibold">ALERT</span>
                   </div>

                   <motion.div 
                      animate={{ x: [-3, 3, -1, 5, -3], y: [1, -3, 2, -1, 1], opacity: [0.4, 0.8, 0.3] }}
                      transition={{ duration: 0.25, repeat: Infinity, repeatType: "mirror" }}
                      className="w-[45%] h-[50%] border-2 border-red-500 mix-blend-screen"
                   />
                </motion.div>
             )}
          </AnimatePresence>

          {/* Init */}
          <AnimatePresence>
             {status === "initializing" && (
                <motion.div exit={{ opacity: 0 }} className="absolute inset-0 bg-[#09090b] flex flex-col items-center justify-center gap-3 z-20">
                   <Activity size={24} className="text-blue-400 animate-pulse" />
                   <span className="text-zinc-500 text-[12px] font-medium">Connecting...</span>
                </motion.div>
             )}
          </AnimatePresence>
       </div>

       {/* Panel */}
       <div className="w-full md:w-72 bg-[#111113] border border-white/[0.06] rounded-2xl p-5 flex flex-col">
          
          <div className="flex items-center gap-3 mb-6 border-b border-white/[0.06] pb-4">
             <Crosshair size={18} className={`flex-shrink-0 ${status === "suspicious" ? "text-red-500" : "text-blue-400"}`} />
             <h2 className="text-[15px] font-bold text-white tracking-tight">Monitor</h2>
          </div>

          <div className="space-y-5 flex-1">
             
             <div className="flex items-center justify-between min-h-[40px]">
                <span className="text-[13px] text-zinc-400">Face Authenticity</span>
                {status === "initializing" ? <span className="text-zinc-700">—</span> :
                 faceAuthentic ? <span className="text-emerald-400 text-[13px] font-semibold">✓ Valid</span> :
                                 <span className="text-red-400 text-[13px] font-semibold animate-pulse">✗ Invalid</span>}
             </div>

             <div className="flex items-center justify-between min-h-[40px]">
                <span className="text-[13px] text-zinc-400">Liveness Check</span>
                {status === "initializing" ? <span className="text-zinc-700">—</span> :
                 livenessCheck ? <span className="text-emerald-400 text-[13px] font-semibold">✓ Passed</span> :
                                 <span className="text-red-400 text-[13px] font-semibold animate-pulse">✗ Failed</span>}
             </div>

             <div className="pt-4 border-t border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                   <span className="text-[13px] text-zinc-400">Deepfake Risk</span>
                   <span className={`text-lg font-bold font-mono ${
                      status === "initializing" ? "text-zinc-600" : 
                      riskScore > 50 ? "text-red-500" : "text-emerald-500"
                   }`}>
                      {status === "initializing" ? "--" : riskScore}%
                   </span>
                </div>
                
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                   <motion.div 
                     className={`h-full ${riskScore > 50 ? 'bg-red-500' : 'bg-emerald-500'}`}
                     animate={{ width: `${status === "initializing" ? 0 : riskScore}%` }}
                     transition={{ duration: 0.3 }}
                   />
                </div>
             </div>
          </div>

          {/* Status */}
          <div className={`mt-6 px-4 py-3 rounded-xl border flex items-center justify-center gap-2 text-[13px] min-h-[44px] ${
             status === "initializing" ? "bg-white/[0.03] border-white/[0.06] text-zinc-500" :
             status === "suspicious" ? "bg-red-500/[0.08] border-red-500/[0.2] text-red-400" :
             "bg-emerald-500/[0.08] border-emerald-500/[0.2] text-emerald-400"
          }`}>
             {status === "initializing" && "Connecting..."}
             {status === "authentic" && <><ShieldCheck size={15} /> <span>Authentic</span></>}
             {status === "suspicious" && <><AlertTriangle size={15} /> <span className="font-semibold">Suspicious</span></>}
          </div>
       </div>
    </div>
  );
}
