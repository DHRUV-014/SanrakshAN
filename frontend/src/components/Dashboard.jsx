import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Upload, Activity, User, Cpu, CheckCircle2,
  Menu, X, ChevronRight, LogOut,
} from "lucide-react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

import { uploadFile, checkJobStatus } from "../api";
import AnalysisTimeline from "./AnalysisTimeline";
import ComparisonSlider from "./ComparisonSlider";
import RiskGauge from "./RiskGauge";
import LivenessChallenge from "./LivenessChallenge";
import AudioAnalysis from "./AudioAnalysis";

const INITIAL_STEPS = [
  { id: "1", name: "Media Ingestion", status: "pending" },
  { id: "2", name: "Biometric Alignment", status: "pending" },
  { id: "3", name: "Classification Engine", status: "pending" },
  { id: "4", name: "Report Generation", status: "pending" },
];

const TABS = ["Analyze", "Audio Analysis", "Spoofing Test", "API"];

const ease = [0.25, 0.1, 0.25, 1];

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("Analyze");
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [image, setImage] = useState(null);
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [typedText, setTypedText] = useState("");

  // Responsive
  const [mobileTabsOpen, setMobileTabsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    setMobileTabsOpen(false);
    setSidebarOpen(false);
  }, [activeTab]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);

    setSteps(INITIAL_STEPS);
    setStatus("PENDING");
    setResult(null);
    setTypedText("");

    const id = await uploadFile(file);
    setJobId(id);
  };

  useEffect(() => {
    if (!jobId || status === "COMPLETED" || status === "FAILED") return;

    const interval = setInterval(async () => {
      const data = await checkJobStatus(jobId);
      setStatus(data.status);

      if (data.status === "PROCESSING") {
        setSteps((s) =>
          s.map((x) => (x.id === "2" || x.id === "3" ? { ...x, status: "loading" } : x))
        );
      }

      if (data.status === "COMPLETED") {
        setResult(data);
        setSteps((s) => s.map((x) => ({ ...x, status: "completed" })));
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, status]);

  useEffect(() => {
    if (!result?.metadata?.reason) {
      setTypedText("");
      return;
    }

    const fullText =
      "No significant manipulation artifacts. " +
      result.metadata.reason +
      " This assessment is derived from facial consistency, frequency artifacts, and cross-region agreement.";

    let i = 0;
    setTypedText("");

    const timer = setInterval(() => {
      setTypedText((prev) => prev + fullText.charAt(i));
      i++;
      if (i >= fullText.length) clearInterval(timer);
    }, 18);

    return () => clearInterval(timer);
  }, [result]);

  return (
    <div className="h-screen bg-[#09090b] text-white flex flex-col font-sans overflow-hidden">

      {/* ═══ TOP BAR ═══ */}
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease }}
        className="h-14 flex items-center justify-between px-4 sm:px-6 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl z-20 flex-shrink-0"
      >
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="bg-[#3b82f6] p-1.5 rounded-md">
              <ShieldCheck size={16} />
            </div>
            <span className="font-bold text-[14px] tracking-tight hidden sm:inline">TrustGuard</span>
          </div>

          {/* Desktop Tabs */}
          <div className="hidden lg:flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-3 xl:px-4 py-1.5 text-[12px] font-semibold rounded-md transition-colors ${
                  activeTab === tab
                    ? "text-white bg-white/[0.06]"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Mobile Tab Selector */}
          <div className="lg:hidden relative">
            <button
              onClick={() => setMobileTabsOpen(!mobileTabsOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold rounded-md bg-white/[0.06] text-white min-h-[36px]"
            >
              {activeTab}
              <ChevronRight size={14} className={`transition-transform ${mobileTabsOpen ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
              {mobileTabsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 bg-[#141416] border border-white/[0.08] rounded-xl shadow-xl z-50 min-w-[180px] overflow-hidden"
                >
                  {TABS.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { setActiveTab(tab); setMobileTabsOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-[12px] font-semibold transition-colors min-h-[44px] ${
                        activeTab === tab
                          ? "bg-blue-500/[0.1] text-blue-400"
                          : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-md bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:text-white transition-colors"
            aria-label="Toggle panel"
          >
            <Activity size={16} />
          </button>

          <div className="flex items-center gap-3 text-[13px] text-zinc-400">
            <div className="flex items-center gap-2">
              <User size={14} />
              <span className="hidden sm:inline">{user?.displayName || "Guest"}</span>
            </div>
            <button
              onClick={async () => { await signOut(auth); if (onLogout) onLogout(); }}
              className="flex items-center justify-center w-8 h-8 rounded-md bg-white/[0.04] border border-white/[0.06] text-zinc-500 hover:text-red-400 hover:border-red-500/20 transition-colors"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </motion.nav>

      {/* ═══ BODY ═══ */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* LEFT SIDEBAR */}
        <aside
          className={`
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0
            fixed lg:relative inset-y-0 left-0 z-30 lg:z-auto
            w-[260px] lg:w-[220px] xl:w-[260px]
            border-r border-white/[0.06] px-5 py-6
            flex flex-col justify-between bg-[#09090b] lg:bg-transparent
            transition-transform duration-200 ease-out
            overflow-y-auto
          `}
        >
          {/* Mobile close */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-3 right-3 w-8 h-8 rounded-md bg-white/[0.04] flex items-center justify-center text-zinc-400 hover:text-white"
          >
            <X size={16} />
          </button>

          <div>
            <h3 className="text-[12px] text-zinc-500 mb-5 flex items-center gap-2 font-semibold tracking-wider">
              <Activity size={12} className="text-blue-400" />
              PIPELINE
            </h3>
            <AnalysisTimeline steps={steps} />
          </div>
        </aside>

        {/* Sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* CENTER */}
        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >

              {/* ═══ ANALYZE TAB ═══ */}
              {activeTab === "Analyze" && (
                <div className="max-w-[900px] mx-auto space-y-6">
                  {/* Upload */}
                  <motion.div
                    whileHover={{ borderColor: "rgba(59, 130, 246, 0.25)" }}
                    onClick={() => fileInputRef.current.click()}
                    className="group border-2 border-dashed border-white/[0.08] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 bg-white/[0.01] hover:bg-white/[0.02] min-h-[200px] py-10"
                  >
                    <div className="p-4 bg-white/[0.03] rounded-2xl group-hover:bg-blue-500/[0.06] transition-colors mb-3">
                      <Upload size={32} className="text-zinc-500 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <p className="text-zinc-300 font-medium text-[14px]">Upload media to analyze</p>
                    <p className="text-[12px] text-zinc-600 mt-1">MP4, PNG, JPG, WEBP</p>
                    <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} />
                  </motion.div>

                  {/* Comparison Slider */}
                  <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4 overflow-hidden">
                    <AnimatePresence mode="wait">
                      {image ? (
                        <motion.div
                          key="comparison-active"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <ComparisonSlider
                            original={image}
                            heatmap={
                              result?.heatmap_url
                                ? `http://localhost:8000/${result.heatmap_url}`
                                : null
                            }
                            isProcessing={status === "PROCESSING"}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="comparison-idle"
                          className="h-[240px] sm:h-[300px] flex items-center justify-center text-zinc-600 text-[13px]"
                        >
                          <span className="animate-pulse">Waiting for input...</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Results Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Verdict */}
                    <div className="p-6 rounded-2xl bg-[#111113] border border-white/[0.06] flex flex-col justify-center items-center">
                      <p className="text-[11px] text-zinc-500 mb-2 uppercase tracking-wider font-medium">Verdict</p>
                      <p className={`text-3xl font-bold ${
                        result?.label === 'REAL' ? 'text-emerald-500' :
                        result?.label === 'FAKE' ? 'text-red-500' : 'text-white'
                      }`}>
                        {result ? result.label : "—"}
                      </p>
                    </div>

                    {/* Gauge */}
                    <div className="p-6 rounded-2xl bg-[#111113] border border-white/[0.06] flex items-center justify-center">
                      {result ? (
                        <RiskGauge score={result.score || result.fake_probability} label={result.label} />
                      ) : (
                        <div className="h-28 flex items-center justify-center text-zinc-600 text-[13px]">
                          Risk assessment pending
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Explanation (inline for all screens) */}
                  <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-5 space-y-4">
                    <h3 className="text-[12px] text-zinc-500 flex items-center gap-2 font-semibold tracking-wider">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      AI EXPLANATION
                    </h3>
                    {result?.metadata?.reason ? (
                      <>
                        <p className="text-zinc-300 leading-relaxed text-[14px] italic">
                          "{typedText || "Analysing forensic signals…"}"
                        </p>
                        {result.metadata?.regions?.length > 0 && (
                          <div>
                            <p className="text-[11px] text-zinc-500 mb-2 font-semibold tracking-wider">INFLUENTIAL REGIONS</p>
                            <div className="flex flex-wrap gap-2">
                              {result.metadata.regions.map((r) => (
                                <span key={r} className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-[11px] text-zinc-400">
                                  {r}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                          <span className="text-[11px] text-zinc-500">Uncertainty</span>
                          <span className="text-[13px] text-blue-400 font-mono">{result.metadata?.uncertainty || "N/A"}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-zinc-600 text-[13px] text-center py-8">
                        <Cpu size={20} className="mx-auto mb-3 opacity-30 animate-pulse" />
                        Upload media to begin analysis.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ AUDIO ANALYSIS TAB ═══ */}
              {activeTab === "Audio Analysis" && (
                <div className="max-w-[900px] mx-auto">
                  <AudioAnalysis />
                </div>
              )}

              {/* ═══ SPOOFING TEST TAB ═══ */}
              {activeTab === "Spoofing Test" && (
                <div className="w-full h-full max-w-[900px] mx-auto">
                  <LivenessChallenge />
                </div>
              )}

              {/* ═══ API TAB ═══ */}
              {activeTab === "API" && (
                <div className="max-w-[600px] mx-auto text-center py-20">
                  <Cpu size={40} className="mx-auto mb-5 text-zinc-700" />
                  <h2 className="text-xl font-bold text-zinc-300 mb-2">API Access</h2>
                  <p className="text-zinc-500 text-[14px]">Coming soon. Integrate TrustGuard into your platform.</p>
                </div>
              )}

              {/* ═══ FALLBACK ═══ */}
              {!TABS.includes(activeTab) && (
                <div className="max-w-[600px] mx-auto text-center py-20">
                  <p className="text-zinc-400 text-[14px]">Invalid tab selected.</p>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* FOOTER */}
      <footer className="h-8 border-t border-white/[0.06] flex items-center justify-between px-4 sm:px-6 text-[10px] text-zinc-600 font-medium bg-[#09090b] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Cpu size={10} className="text-blue-400" />
          <span>TrustGuard v1.0</span>
        </div>
        <div className="flex items-center gap-2 text-emerald-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span className="hidden sm:inline">Connected</span>
        </div>
      </footer>
    </div>
  );
}