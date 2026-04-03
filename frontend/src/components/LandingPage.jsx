import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, ScanSearch, ArrowRight, LogIn,
  CheckCircle2, Menu, X, Mic, Zap, Globe,
  PlayCircle, Music, Activity, Lock, ChevronRight,
  Eye, Cpu, Waves,
} from "lucide-react";
import UploadZone from "./UploadZone";
import AnalysisTimeline from "./AnalysisTimeline";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function LandingPage({ onLogin }) {
  const [demoMode, setDemoMode]         = useState("image");
  const [demoState, setDemoState]       = useState("idle");
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [audioResult, setAudioResult]   = useState(null);
  const [audioFileName, setAudioFileName] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled]         = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const handleAnalyzeFile = async (file) => {
    if (!file) return;
    setDemoState("loading"); setAnalyzeResult(null);
    const fd = new FormData(); fd.append("file", file);
    try {
      const res  = await fetch(`${API_BASE}/analyze`, { method: "POST", body: fd, headers: { "X-Public-Demo": "1" } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status === "error" || data.label == null) { setDemoState("error"); return; }
      setAnalyzeResult(data); setDemoState("done");
    } catch { setDemoState("error"); }
  };

  const runSampleAnalysis = async () => {
    try {
      const res  = await fetch("https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&w=400", { mode: "cors" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      await handleAnalyzeFile(new File([blob], "sample.jpg", { type: blob.type || "image/jpeg" }));
    } catch { setDemoState("error"); }
  };

  const handleAnalyzeAudio = async (file) => {
    if (!file) return;
    setDemoState("loading"); setAudioResult(null); setAudioFileName(file.name);
    const fd = new FormData(); fd.append("file", file);
    try {
      const res  = await fetch(`${API_BASE}/analyze-audio`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status === "error") { setDemoState("error"); return; }
      setAudioResult(data); setDemoState("done");
    } catch { setDemoState("error"); setAudioResult(null); }
  };

  const resetDemo  = () => { setDemoState("idle"); setAnalyzeResult(null); setAudioResult(null); setAudioFileName(null); };
  const switchMode = (m) => { if (m === demoMode) return; resetDemo(); setDemoMode(m); };

  const features = [
    { icon: Eye,        title: "Image & Video",      desc: "Detect face swaps, GAN artifacts, and synthetic media with our ViT ensemble.", accent: "blue"   },
    { icon: Waves,      title: "Audio Deepfake",      desc: "Identify TTS clones, voice synthesis, and spectral manipulation in audio.",    accent: "violet" },
    { icon: ShieldCheck,title: "Liveness Detection",  desc: "rPPG-based spoofing test catches screen replay, printed photos, and masks.",   accent: "emerald"},
    { icon: Globe,      title: "REST API",            desc: "Integrate SanrakshAN into any product with our simple JSON API.",              accent: "orange" },
  ];

  const accentMap = {
    blue:    { bg: "bg-blue-50",    icon: "text-blue-600",    border: "border-blue-100"    },
    violet:  { bg: "bg-violet-50",  icon: "text-violet-600",  border: "border-violet-100"  },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", border: "border-emerald-100" },
    orange:  { bg: "bg-orange-50",  icon: "text-orange-600",  border: "border-orange-100"  },
  };

  const steps = [
    { n: "01", title: "Upload Media",    desc: "Drop an image, video, or audio file — or stream live from your camera." },
    { n: "02", title: "AI Pipeline",     desc: "Face detection, spectral analysis, and neural classification run in parallel." },
    { n: "03", title: "Instant Verdict", desc: "Get REAL / FAKE verdict, confidence score, heatmap, and forensic explanation." },
  ];

  return (
    <div className="min-h-screen w-full bg-white text-gray-900 font-sans overflow-x-hidden">

      {/* ── NAVBAR ── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200/80" : "bg-transparent"
      }`}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <span className="font-bold text-[15px] tracking-tight text-gray-900">SanrakshAN</span>
          </a>

          <div className="hidden md:flex items-center gap-0.5">
            {[["#demo","Demo"],["#features","Features"],["#how-it-works","How It Works"]].map(([href, label]) => (
              <a key={href} href={href}
                className="px-3.5 py-2 text-[13px] text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-all font-medium">
                {label}
              </a>
            ))}
            <div className="w-px h-4 bg-gray-200 mx-3" />
            <button onClick={onLogin}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-semibold rounded-xl transition-all shadow-sm">
              <LogIn size={13} /> Sign In
            </button>
          </div>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            {mobileMenuOpen ? <X size={18} className="text-gray-700" /> : <Menu size={18} className="text-gray-700" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="fixed inset-x-0 top-0 z-40 bg-white pt-20 pb-6 px-5 shadow-xl border-b border-gray-200 md:hidden">
            <div className="flex flex-col gap-1">
              {[["#demo","Demo"],["#features","Features"],["#how-it-works","How It Works"]].map(([href, label]) => (
                <a key={href} href={href} onClick={() => setMobileMenuOpen(false)}
                  className="py-3 px-4 text-[15px] text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors">
                  {label}
                </a>
              ))}
              <div className="h-px bg-gray-100 my-2" />
              <button onClick={() => { onLogin(); setMobileMenuOpen(false); }}
                className="flex items-center justify-center gap-2 py-3.5 bg-gray-900 text-white text-[15px] font-semibold rounded-xl">
                <LogIn size={15} /> Sign In
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HERO ── */}
      <section className="pt-36 pb-24 sm:pt-44 sm:pb-32 relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:64px_64px] opacity-40" />
        {/* Gradient blobs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-40 pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-100 rounded-full blur-3xl opacity-30 pointer-events-none" />

        <div className="max-w-5xl mx-auto px-5 sm:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20 items-center">

            {/* Left */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: "easeOut" }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[12px] font-semibold text-blue-700 tracking-wide">Live AI detection · No sign-up to try</span>
              </div>

              <h1 className="text-[42px] sm:text-[52px] font-extrabold text-gray-900 tracking-tight leading-[1.05] mb-5">
                Detect deepfakes<br />
                <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                  before they spread.
                </span>
              </h1>

              <p className="text-[16px] text-gray-500 leading-relaxed mb-9 max-w-[420px]">
                AI-powered verification for images, video, and audio. Get a forensic verdict in under 2 seconds.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <button
                  onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
                  className="flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-[14px] transition-all shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-200 hover:-translate-y-0.5">
                  Try the Demo <ArrowRight size={15} />
                </button>
                <button onClick={onLogin}
                  className="flex items-center justify-center gap-2 px-7 py-3.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-[14px] transition-all">
                  <Lock size={14} /> Get API Access
                </button>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-8 pt-7 border-t border-gray-100">
                {[["98.7%","Accuracy"],["< 2s","Latency"],["3","Media types"]].map(([val, label]) => (
                  <div key={label}>
                    <div className="text-[18px] font-bold text-gray-900 tabular-nums">{val}</div>
                    <div className="text-[11px] text-gray-400 font-medium mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right — floating result card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.18 }}
              className="hidden lg:block relative">
              {/* Outer glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-violet-100 rounded-3xl blur-2xl opacity-60 scale-95" />
              <div className="relative bg-white rounded-2xl border border-gray-200/80 shadow-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                      <ShieldCheck size={13} className="text-white" />
                    </div>
                    <span className="text-[13px] font-bold text-gray-900">Analysis Report</span>
                  </div>
                  <span className="text-[10px] text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200 font-mono">#7f3a2e</span>
                </div>

                <div className="bg-gradient-to-r from-red-50 to-red-50/50 border border-red-200/80 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Verdict</div>
                    <div className="text-[24px] font-extrabold text-red-600 leading-none">FAKE</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-gray-400 mb-1">Confidence</div>
                    <div className="text-[24px] font-extrabold text-gray-900 tabular-nums leading-none">94.2%</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[["Faces","1"],["Frames","47"],["Risk","High"]].map(([k,v]) => (
                    <div key={k} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                      <div className="text-[11px] text-gray-400 mb-1">{k}</div>
                      <div className="text-[14px] font-bold text-gray-900">{v}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {["GAN artifacts","Face swap","Frequency anomaly"].map(t => (
                    <span key={t} className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-full font-semibold">{t}</span>
                  ))}
                </div>

                {/* Confidence bar */}
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
                    <span>Fake probability</span><span>94.2%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[94%] bg-gradient-to-r from-red-400 to-red-600 rounded-full" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── LIVE DEMO ── */}
      <section id="demo" className="py-24 bg-gray-50/80 border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full mb-5 shadow-sm">
              <Zap size={12} className="text-blue-600" />
              <span className="text-[12px] font-semibold text-gray-600">Live Demo — No account needed</span>
            </div>
            <h2 className="text-[32px] font-bold text-gray-900 mb-3 tracking-tight">See SanrakshAN in action</h2>
            <p className="text-gray-500 text-[15px] max-w-md mx-auto">Upload any media file and get a forensic AI analysis instantly.</p>

            <div className="flex items-center justify-center mt-7">
              <div className="flex gap-1 bg-white border border-gray-200 rounded-2xl p-1 shadow-sm">
                {[["image",<ScanSearch size={13} key="i"/>,"Image / Video"],["audio",<Mic size={13} key="a"/>,"Audio"]].map(([m,icon,label]) => (
                  <button key={m} onClick={() => switchMode(m)}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                      demoMode === m ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}>
                    {icon}{label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
              {/* Input */}
              <div className="p-7 sm:p-9">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Input</span>
                </div>

                {demoMode === "image" ? (
                  <>
                    <UploadZone onUpload={handleAnalyzeFile} />
                    <button onClick={runSampleAnalysis}
                      className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-[12px] text-gray-400 hover:text-blue-600 transition-colors font-medium">
                      <PlayCircle size={13} /> Try with sample image
                    </button>
                  </>
                ) : (
                  <div onClick={() => document.getElementById("landing-audio-input")?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handleAnalyzeAudio(e.dataTransfer.files?.[0]); }}
                    className="border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all min-h-[180px] py-10 group">
                    <div className="w-14 h-14 bg-violet-50 border border-violet-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-violet-100 transition-colors">
                      <Music size={24} className="text-violet-500" />
                    </div>
                    <p className="text-[13px] font-semibold text-gray-700">Drop audio file or click to browse</p>
                    <p className="text-[12px] text-gray-400 mt-1.5">WAV · MP3 · FLAC · OGG</p>
                    {audioFileName && <p className="text-[11px] text-blue-500 mt-2 font-mono">{audioFileName}</p>}
                    <input id="landing-audio-input" type="file" hidden accept="audio/*,.wav,.mp3,.flac"
                      onChange={e => handleAnalyzeAudio(e.target.files?.[0])} />
                  </div>
                )}
              </div>

              {/* Output */}
              <div className="p-7 sm:p-9 flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <div className={`w-2 h-2 rounded-full transition-all ${
                    demoState === "loading" ? "bg-amber-400 animate-pulse" :
                    demoState === "done"    ? "bg-emerald-500" :
                    demoState === "error"   ? "bg-red-500" : "bg-gray-200"
                  }`} />
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    {demoState === "loading" ? "Processing…" : demoState === "done" ? "Complete" : demoState === "error" ? "Error" : "Output"}
                  </span>
                </div>

                <AnimatePresence mode="wait">
                  {demoState === "idle" && (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-16 h-16 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-center mb-4">
                        {demoMode === "image" ? <ScanSearch size={26} className="text-gray-300" /> : <Activity size={26} className="text-gray-300" />}
                      </div>
                      <p className="text-[14px] text-gray-400 font-medium">Waiting for input</p>
                      <p className="text-[12px] text-gray-300 mt-1">Upload a file to begin</p>
                    </motion.div>
                  )}

                  {demoState === "loading" && (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1">
                      <AnalysisTimeline steps={[
                        { id:"1", name:"Media Ingestion",    status:"completed" },
                        { id:"2", name:"AI Classification",  status:"loading"   },
                        { id:"3", name:"Report Generation",  status:"pending"   },
                      ]} />
                    </motion.div>
                  )}

                  {demoState === "error" && (
                    <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center mb-4">
                        <X size={22} className="text-red-500" />
                      </div>
                      <p className="text-[14px] font-semibold text-gray-700 mb-1">Analysis failed</p>
                      <p className="text-[12px] text-gray-400 mb-4">Check file format and try again</p>
                      <button onClick={resetDemo}
                        className="px-4 py-2 border border-gray-200 rounded-xl text-[12px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                        Try Again
                      </button>
                    </motion.div>
                  )}

                  {demoState === "done" && (demoMode === "image" ? analyzeResult : audioResult) && (
                    <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex-1 space-y-4">
                      {(() => {
                        const r = demoMode === "image" ? analyzeResult : audioResult;
                        const isReal = r.label === "REAL";
                        const conf   = ((r.confidence ?? r.score ?? 0) * 100).toFixed(1);
                        return (
                          <>
                            <div className={`rounded-xl p-4 border flex items-center justify-between ${
                              isReal ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                            }`}>
                              <div>
                                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isReal ? "text-emerald-500" : "text-red-400"}`}>Verdict</p>
                                <p className={`text-[24px] font-extrabold leading-none ${isReal ? "text-emerald-600" : "text-red-600"}`}>{r.label}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-gray-400 mb-1">Confidence</p>
                                <p className="text-[24px] font-extrabold text-gray-900 tabular-nums leading-none">{conf}%</p>
                              </div>
                            </div>

                            <div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${conf}%` }} transition={{ duration: 0.9, ease: "easeOut" }}
                                  className={`h-full rounded-full ${isReal ? "bg-emerald-500" : "bg-red-500"}`} />
                              </div>
                            </div>

                            {r.explanation && (
                              <p className="text-[12px] text-gray-500 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">
                                {r.explanation.slice(0, 160)}{r.explanation.length > 160 ? "…" : ""}
                              </p>
                            )}

                            <button onClick={resetDemo}
                              className="w-full py-2.5 border border-gray-200 rounded-xl text-[12px] font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                              Analyze Another
                            </button>
                          </>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-14">
            <h2 className="text-[32px] font-bold text-gray-900 tracking-tight mb-3">Everything you need to verify media</h2>
            <p className="text-gray-500 text-[15px] max-w-lg mx-auto">One platform for all types of deepfake and synthetic media detection.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map(({ icon: Icon, title, desc, accent }) => {
              const a = accentMap[accent];
              return (
                <motion.div key={title} whileHover={{ y: -3 }} transition={{ duration: 0.2 }}
                  className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-md transition-all">
                  <div className={`w-11 h-11 ${a.bg} border ${a.border} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon size={20} className={a.icon} />
                  </div>
                  <h3 className="text-[14px] font-bold text-gray-900 mb-2">{title}</h3>
                  <p className="text-[12px] text-gray-500 leading-relaxed">{desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 bg-gray-50 border-y border-gray-200">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-14">
            <h2 className="text-[32px] font-bold text-gray-900 tracking-tight mb-3">How it works</h2>
            <p className="text-gray-500 text-[15px]">Three steps from upload to verified result.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map(({ n, title, desc }, i) => (
              <div key={n} className="relative">
                <div className="bg-white rounded-2xl border border-gray-200 p-7 h-full hover:shadow-sm transition-all">
                  <div className="text-[11px] font-bold text-blue-500 tracking-widest mb-4 font-mono">{n}</div>
                  <h3 className="text-[15px] font-bold text-gray-900 mb-2">{title}</h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed">{desc}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10">
                    <div className="w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm">
                      <ChevronRight size={13} className="text-gray-400" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
          <div className="relative bg-gradient-to-br from-blue-600 to-violet-600 rounded-3xl p-12 overflow-hidden shadow-xl">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-full mb-6">
                <Cpu size={12} className="text-white" />
                <span className="text-[12px] font-semibold text-white/90">API ready · Deploy in minutes</span>
              </div>
              <h2 className="text-[30px] font-bold text-white mb-4 tracking-tight">Start verifying media today</h2>
              <p className="text-white/70 text-[15px] mb-8 max-w-md mx-auto">
                Sign in to access the full dashboard — history, API keys, audio analysis, and liveness detection.
              </p>
              <button onClick={onLogin}
                className="inline-flex items-center gap-2.5 px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-bold rounded-2xl text-[14px] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                <LogIn size={15} /> Get Started Free
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
              <ShieldCheck size={12} className="text-white" />
            </div>
            <span className="text-[13px] font-bold text-gray-900">SanrakshAN</span>
            <span className="text-[12px] text-gray-400 ml-1">AI Deepfake Detection</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[12px] text-gray-400">All systems operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
