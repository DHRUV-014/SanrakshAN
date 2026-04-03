import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Upload, Activity, Cpu, CheckCircle2,
  LogOut, ScanSearch, Mic, Zap, X, User, Volume2,
  History, MessageCircle, Code, Sun, Moon, Menu,
} from "lucide-react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

import { uploadFile, checkJobStatus } from "../api";
import AnalysisTimeline from "./AnalysisTimeline";
import ComparisonSlider from "./ComparisonSlider";
import RiskGauge from "./RiskGauge";
import LivenessChallenge from "./LivenessChallenge";
import AudioAnalysis from "./AudioAnalysis";
import HistoryTab from "./HistoryTab";
import ApiTab from "./ApiTab";
import WhatsAppTab from "./WhatsAppTab";

const INITIAL_STEPS = [
  { id: "1", name: "Media Ingestion",     status: "pending" },
  { id: "2", name: "Biometric Alignment", status: "pending" },
  { id: "3", name: "Classification",      status: "pending" },
  { id: "4", name: "Report Generation",   status: "pending" },
];

const NAV = [
  { id: "Analyze",   label: "Analyze",   icon: ScanSearch,     section: "detection" },
  { id: "Audio",     label: "Audio",     icon: Mic,            section: "detection" },
  { id: "Liveness",  label: "Liveness",  icon: Zap,            section: "detection" },
  { id: "History",   label: "History",   icon: History,        section: "tools"     },
  { id: "API",       label: "API",       icon: Code,           section: "tools"     },
  { id: "WhatsApp",  label: "WhatsApp",  icon: MessageCircle,  section: "tools", badge: "NEW" },
];

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("tg_dark") === "1"; } catch { return false; }
  });
  useEffect(() => {
    const root = document.documentElement;
    dark ? root.classList.add("dark") : root.classList.remove("dark");
    try { localStorage.setItem("tg_dark", dark ? "1" : "0"); } catch {}
  }, [dark]);
  return [dark, setDark];
}

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("Analyze");
  const [jobId, setJobId]         = useState(null);
  const [status, setStatus]       = useState(null);
  const [result, setResult]       = useState(null);
  const [image, setImage]         = useState(null);
  const [steps, setSteps]         = useState(INITIAL_STEPS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark]           = useDarkMode();

  const fileInputRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  useEffect(() => { setSidebarOpen(false); }, [activeTab]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
    setSteps(INITIAL_STEPS);
    setStatus("PENDING");
    setResult(null);
    const id = await uploadFile(file);
    setJobId(id);
  };

  useEffect(() => {
    if (!jobId || status === "COMPLETED" || status === "FAILED") return;
    const interval = setInterval(async () => {
      const data = await checkJobStatus(jobId);
      setStatus(data.status);
      if (data.status === "PROCESSING") {
        setSteps(s => s.map(x => (x.id === "2" || x.id === "3" ? { ...x, status: "loading" } : x)));
      }
      if (data.status === "COMPLETED") {
        setResult(data);
        setSteps(s => s.map(x => ({ ...x, status: "completed" })));
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId, status]);

  const detectionNav = NAV.filter(n => n.section === "detection");
  const toolsNav     = NAV.filter(n => n.section === "tools");

  return (
    <div className="h-screen flex overflow-hidden font-sans bg-gray-50 dark:bg-gray-950 transition-colors duration-200">

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      {/* ── DARK SIDEBAR ── */}
      <aside className={`
        fixed lg:relative z-50 lg:z-auto
        flex flex-col h-full w-[220px] flex-shrink-0
        bg-gray-950 dark:bg-black
        border-r border-white/[0.06]
        transition-transform duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-14 border-b border-white/[0.06] flex-shrink-0">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50">
            <ShieldCheck size={14} className="text-white" />
          </div>
          <span className="font-bold text-[14px] text-white tracking-tight">SanrakshAN</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-5 overflow-y-auto">
          {/* Detection group */}
          <div>
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest px-2.5 mb-2">Detection</p>
            <div className="space-y-0.5">
              {detectionNav.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                    activeTab === id
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                      : "text-white/50 hover:text-white/90 hover:bg-white/[0.06]"
                  }`}>
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tools group */}
          <div>
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest px-2.5 mb-2">Tools</p>
            <div className="space-y-0.5">
              {toolsNav.map(({ id, label, icon: Icon, badge }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                    activeTab === id
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                      : "text-white/50 hover:text-white/90 hover:bg-white/[0.06]"
                  }`}>
                  <Icon size={15} />
                  {label}
                  {badge && (
                    <span className="ml-auto text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Pipeline — Analyze tab only */}
        {activeTab === "Analyze" && (
          <div className="px-4 py-4 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={11} className="text-blue-400" />
              <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Pipeline</span>
            </div>
            <AnalysisTimeline steps={steps} dark />
          </div>
        )}

        {/* Last result */}
        {result && (
          <div className="px-4 pb-3">
            <div className={`rounded-xl p-3 border ${
              result.label === "REAL" ? "bg-emerald-500/10 border-emerald-500/20" :
              result.label === "FAKE" ? "bg-red-500/10 border-red-500/20" :
              "bg-amber-500/10 border-amber-500/20"
            }`}>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-white/30 mb-0.5">Last Result</div>
              <div className={`text-[15px] font-bold ${
                result.label === "REAL" ? "text-emerald-400" :
                result.label === "FAKE" ? "text-red-400" : "text-amber-400"
              }`}>{result.label}</div>
              <div className="text-[11px] text-white/40">
                {((result.confidence ?? result.score ?? 0) * 100).toFixed(1)}% confidence
              </div>
            </div>
          </div>
        )}

        {/* Bottom */}
        <div className="px-3 py-3 border-t border-white/[0.06] space-y-0.5">
          <button onClick={() => setDark(!dark)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-[12px] font-medium text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all">
            {dark ? <Sun size={13} /> : <Moon size={13} />}
            {dark ? "Light Mode" : "Dark Mode"}
          </button>
          <div className="flex items-center gap-2.5 px-2.5 py-2.5">
            <div className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <User size={11} className="text-blue-400" />
            </div>
            <span className="text-[12px] text-white/40 font-medium flex-1 truncate">
              {user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "User"}
            </span>
            <button onClick={async () => { await signOut(auth); if (onLogout) onLogout(); }}
              title="Sign out" className="text-white/25 hover:text-red-400 transition-colors">
              <LogOut size={12} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3 px-4 sm:px-6 flex-shrink-0 shadow-sm">
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Menu size={17} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-gray-900 dark:text-white">
              {NAV.find(n => n.id === activeTab)?.label}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hidden sm:inline">Connected</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-950">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}>

              {/* ── ANALYZE ── */}
              {activeTab === "Analyze" && (
                <div className="max-w-3xl mx-auto space-y-5">
                  <div>
                    <h1 className="text-[20px] font-bold text-gray-900 dark:text-white">Media Analysis</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">Upload an image or video to run deepfake detection.</p>
                  </div>

                  {/* Upload zone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { const input = fileInputRef.current; if (input) { const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; handleFileUpload({ target: input }); } } }}
                    className="bg-white dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all min-h-[152px] py-10 group"
                  >
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-blue-50 group-hover:border-blue-200 dark:group-hover:bg-blue-950/50 transition-colors">
                      <Upload size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">Drop file or click to browse</p>
                    <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">PNG · JPG · WEBP · MP4 · MOV · AVI</p>
                    <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" />
                  </div>

                  {/* Visual analysis */}
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                    <div className="border-b border-gray-100 dark:border-gray-800 px-5 py-3.5 flex items-center gap-2">
                      <ScanSearch size={13} className="text-gray-400" />
                      <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Visual Analysis</span>
                      {result?.heatmap_url && (
                        <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900 px-2 py-0.5 rounded-full font-bold">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />Saliency Map
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      {image ? (
                        <ComparisonSlider
                          original={image}
                          heatmap={result?.heatmap_url ? `${API_URL}${result.heatmap_url}` : null}
                          isProcessing={status === "PROCESSING"}
                        />
                      ) : (
                        <div className="h-48 flex flex-col items-center justify-center gap-2">
                          <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
                            <ScanSearch size={20} className="text-gray-300 dark:text-gray-600" />
                          </div>
                          <p className="text-[12px] text-gray-300 dark:text-gray-600 font-medium">Upload media to see visual analysis</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Results row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Verdict */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Verdict</p>
                      {result ? (
                        <>
                          <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[17px] font-extrabold border mb-4 ${
                            result.label === "REAL" ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900" :
                            result.label === "FAKE" ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900" :
                            "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900"
                          }`}>
                            {result.label === "REAL" ? <CheckCircle2 size={17} /> : <X size={17} />}
                            {result.label}
                          </div>
                          {/* Confidence bar */}
                          <div>
                            <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
                              <span>Confidence</span>
                              <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                                {((result.confidence ?? result.score ?? 0) * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${((result.confidence ?? result.score ?? 0) * 100).toFixed(1)}%` }}
                                transition={{ duration: 0.9, ease: "easeOut" }}
                                className={`h-full rounded-full ${
                                  result.label === "REAL" ? "bg-emerald-500" :
                                  result.label === "FAKE" ? "bg-red-500" : "bg-amber-500"
                                }`}
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <div className="h-10 bg-gray-50 dark:bg-gray-800 rounded-xl animate-pulse" />
                          <div className="h-2 bg-gray-50 dark:bg-gray-800 rounded-full animate-pulse" />
                        </div>
                      )}
                    </div>

                    {/* Risk Gauge */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 flex items-center justify-center">
                      {result ? (
                        <RiskGauge score={result.score || result.fake_probability || 0} label={result.label} />
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-4">
                          <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-2xl" />
                          <div className="text-[12px] text-gray-300 dark:text-gray-600">Risk gauge</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Explanation */}
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Cpu size={13} className="text-blue-500" />
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">AI Explanation</span>
                      </div>
                      {result?.tts_url && (
                        <button onClick={() => new Audio(`${API_URL}${result.tts_url}`).play()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400 text-[11px] font-semibold transition-colors">
                          <Volume2 size={11} /> Play
                        </button>
                      )}
                    </div>
                    {result?.explanation ? (
                      <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">{result.explanation}</p>
                    ) : result ? (
                      <p className="text-[12px] text-gray-400 italic">No explanation available.</p>
                    ) : (
                      <div className="flex flex-col items-center py-8 gap-2">
                        <Cpu size={22} className="text-gray-200 dark:text-gray-700" />
                        <p className="text-[12px] text-gray-400">Upload media to begin forensic analysis</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── AUDIO ── */}
              {activeTab === "Audio" && (
                <div className="max-w-2xl mx-auto">
                  <div className="mb-6">
                    <h1 className="text-[20px] font-bold text-gray-900 dark:text-white">Audio Analysis</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">Detect synthetic speech, voice clones, and TTS audio.</p>
                  </div>
                  <AudioAnalysis />
                </div>
              )}

              {/* ── LIVENESS ── */}
              {activeTab === "Liveness" && (
                <div className="max-w-2xl mx-auto">
                  <div className="mb-6">
                    <h1 className="text-[20px] font-bold text-gray-900 dark:text-white">Liveness Detection</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">rPPG-based spoofing test — detects screen replay and printed photos.</p>
                  </div>
                  <LivenessChallenge />
                </div>
              )}

              {/* ── HISTORY ── */}
              {activeTab === "History" && <HistoryTab />}

              {/* ── API ── */}
              {activeTab === "API" && <ApiTab />}

              {/* ── WHATSAPP ── */}
              {activeTab === "WhatsApp" && <WhatsAppTab />}

            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
