import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Activity, Loader2, CheckCircle2, AlertCircle, Music } from "lucide-react";
import { analyzeAudio } from "../api";

export default function AudioAnalysis() {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setState("loading");
    setResult(null);
    setFileName(file.name);

    try {
      const data = await analyzeAudio(file);
      setResult(data);
      setState("done");
    } catch (err) {
      console.error("Audio analysis failed:", err);
      setState("error");
      setResult(null);
    }
  };

  const reset = () => {
    setState("idle");
    setResult(null);
    setFileName(null);
  };

  const label = result?.label || result?.verdict;
  const score = result?.score ?? result?.confidence ?? result?.fake_probability;
  const isReal = label === "REAL" || label === "real";

  return (
    <div className="max-w-[700px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Activity size={20} className="text-purple-400" />
          Audio Deepfake Detection
        </h2>
        <p className="text-zinc-500 text-[13px] mt-1">
          Upload an audio file to analyze for synthetic speech patterns.
        </p>
      </div>

      {/* Upload */}
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`group border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 min-h-[200px] py-10 ${
          isDragging
            ? "border-purple-500/50 bg-purple-500/[0.06]"
            : "border-white/[0.08] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/[0.12]"
        }`}
      >
        <div className={`p-4 rounded-2xl border transition-all duration-200 mb-3 ${
          isDragging
            ? "bg-purple-500 border-purple-400"
            : "bg-white/[0.03] border-white/[0.06] group-hover:border-purple-500/30 group-hover:bg-purple-500/[0.06]"
        }`}>
          <Music
            size={28}
            className={`${isDragging ? "text-white" : "text-zinc-500 group-hover:text-purple-400"} transition-colors`}
          />
        </div>

        <p className="text-[13px] font-medium text-zinc-300">
          {isDragging ? "Drop audio file" : "Drop audio file or click to browse"}
        </p>
        <p className="text-[11px] text-zinc-600 mt-1">WAV, MP3, FLAC</p>

        {fileName && state !== "idle" && (
          <div className="mt-3 px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg">
            <p className="text-[11px] text-zinc-400 font-mono truncate max-w-[240px]">{fileName}</p>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          hidden
          accept="audio/*,.wav,.mp3,.flac"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </motion.div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {state === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-white/[0.06] bg-[#111113] p-8 text-center"
          >
            <Loader2 size={28} className="text-purple-400 animate-spin mx-auto mb-4" />
            <p className="text-[14px] text-zinc-300 font-medium">Analyzing audio…</p>
            <p className="text-[12px] text-zinc-500 mt-1">Spectral pattern analysis in progress</p>
          </motion.div>
        )}

        {state === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-red-500/[0.15] bg-red-500/[0.04] p-8 text-center"
          >
            <AlertCircle size={28} className="text-red-400 mx-auto mb-4" />
            <p className="text-[14px] text-zinc-300 font-medium">Analysis failed</p>
            <p className="text-[12px] text-zinc-500 mt-1">Please try again with a different file.</p>
            <button
              onClick={reset}
              className="mt-5 px-5 py-2.5 border border-white/[0.08] hover:border-white/[0.14] rounded-lg text-[13px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all"
            >
              Reset
            </button>
          </motion.div>
        )}

        {state === "done" && result && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-white/[0.06] bg-[#111113] p-6 space-y-5"
          >
            <h3 className="text-[12px] text-zinc-500 flex items-center gap-2 font-semibold tracking-wider">
              <CheckCircle2 size={13} className="text-emerald-500" />
              ANALYSIS RESULT
            </h3>

            {/* Verdict + Score */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                <p className="text-[11px] text-zinc-500 mb-2 uppercase tracking-wider font-medium">Verdict</p>
                <p className={`text-3xl font-bold ${isReal ? 'text-emerald-500' : 'text-red-500'}`}>
                  {label || "—"}
                </p>
              </div>
              <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                <p className="text-[11px] text-zinc-500 mb-2 uppercase tracking-wider font-medium">Confidence</p>
                <p className="text-3xl font-bold text-white font-mono">
                  {score != null ? `${(score * 100).toFixed(1)}%` : "—"}
                </p>
              </div>
            </div>

            {/* Status badge */}
            <div className={`px-4 py-3 rounded-xl border text-[13px] font-semibold text-center flex items-center justify-center gap-2 ${
              isReal
                ? "bg-emerald-500/[0.08] border-emerald-500/[0.2] text-emerald-400"
                : "bg-red-500/[0.08] border-red-500/[0.2] text-red-400"
            }`}>
              {isReal ? (
                <>
                  <CheckCircle2 size={15} />
                  Audio appears authentic
                </>
              ) : (
                <>
                  <AlertCircle size={15} />
                  Synthetic audio detected
                </>
              )}
            </div>

            {/* Reset */}
            <div className="text-center pt-2">
              <button
                onClick={reset}
                className="px-5 py-2.5 border border-white/[0.08] hover:border-white/[0.14] rounded-lg text-[13px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all"
              >
                Analyze Another File
              </button>
            </div>
          </motion.div>
        )}

        {state === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-dashed border-white/[0.06] p-10 text-center text-zinc-600"
          >
            <Activity size={28} className="mx-auto mb-3 opacity-20" />
            <p className="text-[14px]">Upload audio to begin analysis</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
