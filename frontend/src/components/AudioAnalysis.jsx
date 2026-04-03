import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, Upload,
  Loader2, CheckCircle2, AlertCircle,
  Square, RotateCcw, Activity, Volume2,
} from "lucide-react";
import { analyzeAudio } from "../api";

// ─── Mode tabs ────────────────────────────────────────────────────────────────
const MODES = [
  { id: "record", label: "Record Voice", icon: Mic },
  { id: "upload", label: "Upload File",  icon: Upload },
];

// ─── Result panel ────────────────────────────────────────────────────────────
function ResultPanel({ result, onReset }) {
  const label   = result?.label || result?.verdict;
  const score   = result?.score ?? result?.confidence ?? result?.fake_probability;
  const isReal  = label === "REAL" || label === "real";
  const pct     = score != null ? (score * 100).toFixed(1) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-gray-400 flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-green-500" />
          Analysis Result
        </span>
        {result.input_type && (
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            {result.input_type}
          </span>
        )}
      </div>

      {/* Verdict + Confidence */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-1.5">Verdict</p>
          <p className={`text-2xl font-bold ${isReal ? "text-green-600" : "text-red-600"}`}>
            {label || "—"}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-1.5">Confidence</p>
          <p className="text-2xl font-bold text-gray-900 font-mono">
            {pct != null ? `${pct}%` : "—"}
          </p>
        </div>
      </div>

      {/* Confidence bar */}
      {pct != null && (
        <div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full rounded-full ${isReal ? "bg-green-500" : "bg-red-500"}`}
            />
          </div>
        </div>
      )}

      {/* Status banner */}
      <div className={`px-4 py-3 rounded-xl border text-[13px] font-semibold flex items-center justify-center gap-2 ${
        isReal
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-red-50 border-red-200 text-red-700"
      }`}>
        {isReal
          ? <><CheckCircle2 size={14} /> Audio appears authentic</>
          : <><AlertCircle size={14} /> Synthetic audio detected</>
        }
      </div>

      {/* Explanation */}
      {result.explanation && (
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Why?</p>
          <p className="text-[13px] text-gray-700 leading-relaxed">{result.explanation}</p>
          {result.tts_url && (
            <button
              onClick={() => new Audio(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${result.tts_url}`).play()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-[12px] font-medium transition-colors"
            >
              <Volume2 size={13} />
              Play Explanation
            </button>
          )}
        </div>
      )}

      {/* Meta */}
      {(result.method || result.processing_time) && (
        <p className="text-[11px] text-gray-400 text-center">
          {result.method && <>Method: <span className="text-gray-600 font-medium">{result.method}</span></>}
          {result.method && result.processing_time && <span className="mx-1.5">·</span>}
          {result.processing_time && <>{result.processing_time}</>}
        </p>
      )}

      <div className="text-center pt-1">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 hover:border-gray-300 rounded-lg text-[13px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all"
        >
          <RotateCcw size={13} />
          Analyze Another
        </button>
      </div>
    </motion.div>
  );
}

// ─── Mic Recorder ────────────────────────────────────────────────────────────
function MicRecorder({ onFile, disabled }) {
  const [recState, setRecState] = useState("idle"); // idle | recording | done
  const [seconds, setSeconds] = useState(0);
  const [permError, setPermError] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const MAX_SECONDS = 10;

  const stop = useCallback(() => {
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
    clearInterval(timerRef.current);
  }, []);

  // Auto-stop at MAX_SECONDS
  useEffect(() => {
    if (recState === "recording" && seconds >= MAX_SECONDS) stop();
  }, [seconds, recState, stop]);

  const start = async () => {
    setPermError(false);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: getSupportedMime() });
      mediaRef.current = mr;

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const mime = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        const ext  = mime.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `recording.${ext}`, { type: mime });
        setRecState("done");
        onFile(file);
      };

      mr.start(200);
      setRecState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (err) {
      if (err.name === "NotAllowedError") setPermError(true);
      console.error("Mic error:", err);
    }
  };

  const reset = () => { setRecState("idle"); setSeconds(0); };

  return (
    <div className="flex flex-col items-center gap-5 py-6">
      {permError && (
        <div className="w-full px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-700 text-center">
          Microphone access was denied. Allow it in your browser settings and try again.
        </div>
      )}

      {/* Big mic button */}
      <div className="relative">
        <button
          onClick={recState === "recording" ? stop : recState === "done" ? reset : start}
          disabled={disabled}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 shadow-md focus:outline-none ${
            recState === "recording"
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {recState === "recording"
            ? <Square size={22} />
            : recState === "done"
            ? <RotateCcw size={22} />
            : <Mic size={22} />
          }
        </button>

        {recState === "recording" && (
          <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-60" />
        )}
      </div>

      {/* State label */}
      <div className="text-center">
        {recState === "idle" && (
          <p className="text-[13px] text-gray-500">Click to start recording <span className="text-gray-400">(max {MAX_SECONDS}s)</span></p>
        )}
        {recState === "recording" && (
          <>
            <p className="text-[13px] font-semibold text-red-600">Recording… {seconds}s / {MAX_SECONDS}s</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Click the button or wait to auto-stop</p>
          </>
        )}
        {recState === "done" && (
          <p className="text-[13px] text-gray-500">Recording complete — analyzing…</p>
        )}
      </div>

      {/* Timer bar */}
      {recState === "recording" && (
        <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${(seconds / MAX_SECONDS) * 100}%` }}
            transition={{ duration: 0.5, ease: "linear" }}
            className="h-full bg-red-500 rounded-full"
          />
        </div>
      )}
    </div>
  );
}

function getSupportedMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || "";
}

// ─── File drop zone ───────────────────────────────────────────────────────────
function DropZone({ accept, label, hint, icon: Icon, onFile, disabled }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (f) => { if (f) onFile(f); };

  return (
    <motion.div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`group border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 min-h-[200px] py-10 ${
        disabled ? "opacity-50 cursor-not-allowed" :
        dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300"
      }`}
    >
      <div className={`p-4 rounded-2xl border mb-3 transition-all duration-200 ${
        dragging ? "bg-blue-600 border-blue-500" : "bg-white border-gray-200 group-hover:border-blue-300 group-hover:bg-blue-50"
      }`}>
        <Icon size={26} className={`${dragging ? "text-white" : "text-gray-400 group-hover:text-blue-600"} transition-colors`} />
      </div>
      <p className="text-[13px] font-medium text-gray-700">{dragging ? "Drop file here" : label}</p>
      <p className="text-[11px] text-gray-400 mt-1">{hint}</p>
      <input type="file" ref={inputRef} hidden accept={accept} onChange={(e) => handleFile(e.target.files?.[0])} />
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AudioAnalysis() {
  const [mode, setMode]       = useState("record");
  const [status, setStatus]   = useState("idle");   // idle | loading | done | error
  const [result, setResult]   = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fileName, setFileName] = useState(null);

  const submit = async (file) => {
    setStatus("loading");
    setResult(null);
    setFileName(file.name);
    try {
      const data = await analyzeAudio(file);
      setResult(data);
      setStatus("done");
    } catch (err) {
      console.error("Audio analysis failed:", err);
      setErrorMsg(err?.response?.data?.detail || "Analysis failed. Please try another file.");
      setStatus("error");
    }
  };

  const reset = () => { setStatus("idle"); setResult(null); setFileName(null); setErrorMsg(""); };

  return (
    <div className="max-w-[680px] mx-auto space-y-5">

      {/* Mode selector */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setMode(id); reset(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-[13px] font-medium transition-all duration-150 ${
              mode === id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={15} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Input area (only shown when idle/error) */}
      <AnimatePresence mode="wait">
        {status !== "done" && (
          <motion.div key={mode} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {mode === "record" && (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <MicRecorder onFile={submit} disabled={status === "loading"} />
              </div>
            )}
            {mode === "upload" && (
              <DropZone
                accept=".wav,.mp3,.flac,.ogg,.webm,.m4a,.mp4,.mov,.avi,.mkv,audio/*,video/*"
                label="Drop audio or video file, or click to browse"
                hint="Audio: WAV · MP3 · FLAC · M4A   |   Video: MP4 · MOV · AVI · MKV"
                icon={Upload}
                onFile={submit}
                disabled={status === "loading"}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* States */}
      <AnimatePresence mode="wait">
        {status === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm"
          >
            <Loader2 size={28} className="text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-[14px] text-gray-800 font-medium">
              {fileName && /\.(mp4|mov|avi|mkv)$/i.test(fileName) ? "Extracting & analyzing audio…" : "Analyzing audio…"}
            </p>
            {fileName && <p className="text-[11px] text-gray-400 mt-1.5 font-mono truncate max-w-[300px] mx-auto">{fileName}</p>}
            <p className="text-[11px] text-gray-400 mt-1">Spectral pattern analysis in progress</p>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
          >
            <AlertCircle size={26} className="text-red-500 mx-auto mb-3" />
            <p className="text-[14px] text-gray-800 font-medium">Analysis failed</p>
            <p className="text-[12px] text-gray-500 mt-1">{errorMsg}</p>
            <button
              onClick={reset}
              className="mt-4 px-4 py-2 border border-gray-200 hover:border-gray-300 rounded-lg text-[13px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all"
            >
              Try Again
            </button>
          </motion.div>
        )}

        {status === "done" && result && (
          <ResultPanel key="done" result={result} onReset={reset} />
        )}

        {status === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-dashed border-gray-200 p-8 text-center"
          >
            <Activity size={24} className="mx-auto mb-2.5 text-gray-300" />
            <p className="text-[13px] text-gray-400">
              {mode === "record" && "Record a voice sample to check for AI synthesis"}
              {mode === "upload" && "Upload an audio or video file — video audio is extracted automatically"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
