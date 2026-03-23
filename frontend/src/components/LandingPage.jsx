import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, ScanSearch, Cpu, PlayCircle, Activity,
  AlertCircle, Layers, Fingerprint, ArrowRight, ChevronDown,
  LogIn, CheckCircle2, Menu, X, Database, Mic, Music
} from "lucide-react";

import UploadZone from "./UploadZone";
import ResultCard from "./ResultCard";
import AnalysisTimeline from "./AnalysisTimeline";
import RiskGauge from "./RiskGauge";


const ease = [0.25, 0.1, 0.25, 1];

const API_BASE = "http://127.0.0.1:8000";
const ANALYZE_URL = `${API_BASE}/analyze`;
const ANALYZE_AUDIO_URL = `${API_BASE}/analyze-audio`;

export default function LandingPage({ onLogin }) {
  const [demoMode, setDemoMode] = useState("image"); // "image" | "audio"
  const [demoState, setDemoState] = useState("idle"); // idle | loading | done | error
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [audioResult, setAudioResult] = useState(null);
  const [audioFileName, setAudioFileName] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleAnalyzeFile = async (file) => {
    if (!file) return;
    setDemoState("loading");
    setAnalyzeResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(ANALYZE_URL, {
        method: "POST",
        body: formData,
        headers: { "X-Public-Demo": "1" },
      });

      const rawText = await res.text();
      let data;
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (parseErr) {
        console.error(parseErr);
        data = { _raw: rawText };
      }

      if (!res.ok) {
        console.error("Analyze HTTP error:", res.status, res.statusText, data);
        setDemoState("error");
        setAnalyzeResult(null);
        return;
      }

      if (data.status === "error") {
        console.error("Analyze pipeline error:", data.message || data);
        setDemoState("error");
        setAnalyzeResult(null);
        return;
      }

      if (data.status === "PENDING") {
        console.error("Unexpected async job response on public demo:", data);
        setDemoState("error");
        setAnalyzeResult(null);
        return;
      }

      if (data.label == null || typeof data.score !== "number" || Number.isNaN(data.score)) {
        console.error("Invalid analyze response (missing label or score):", data);
        setDemoState("error");
        setAnalyzeResult(null);
        return;
      }

      setAnalyzeResult(data);
      setDemoState("done");
    } catch (error) {
      console.error(error);
      setDemoState("error");
      setAnalyzeResult(null);
    }
  };

  const runSampleAnalysis = async () => {
    try {
      const res = await fetch(
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&w=400",
        { mode: "cors" }
      );
      if (!res.ok) throw new Error("sample fetch failed");
      const blob = await res.blob();
      const file = new File([blob], "sample.jpg", { type: blob.type || "image/jpeg" });
      await handleAnalyzeFile(file);
    } catch (error) {
      console.error(error);
      setDemoState("error");
      setAnalyzeResult(null);
    }
  };

  const handleAnalyzeAudio = async (file) => {
    if (!file) return;
    setDemoState("loading");
    setAudioResult(null);
    setAudioFileName(file.name);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(ANALYZE_AUDIO_URL, {
        method: "POST",
        body: formData,
        headers: { "X-Public-Demo": "1" },
      });
      const rawText = await res.text();
      let data;
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (parseErr) {
        console.error(parseErr);
        data = { _raw: rawText };
      }
      if (!res.ok || data.status === "error") {
        console.error("Audio analyze error:", data);
        setDemoState("error");
        return;
      }
      setAudioResult(data);
      setDemoState("done");
    } catch (error) {
      console.error(error);
      setDemoState("error");
      setAudioResult(null);
    }
  };

  const resetDemo = () => {
    setDemoState("idle");
    setAnalyzeResult(null);
    setAudioResult(null);
    setAudioFileName(null);
  };

  const switchMode = (mode) => {
    if (mode === demoMode) return;
    resetDemo();
    setDemoMode(mode);
  };

  const resultForCard =
    analyzeResult &&
    ({
      label: analyzeResult.label,
      score: analyzeResult.score,
      faces_detected: analyzeResult.faces_detected ?? 0,
      face_url: analyzeResult.face_url ?? null,
      heatmap_url: analyzeResult.heatmap_url ?? null,
    });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const navLinks = [
    { href: "#demo", label: "Demo" },
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How It Works" },
  ];

  return (
    <div className="min-h-screen w-full bg-[#09090b] text-zinc-100 font-sans overflow-x-hidden relative">

      {/* ──────────────────────────────────────────────── */}
      {/*  NAVBAR                                         */}
      {/* ──────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#3b82f6] flex items-center justify-center">
              <ShieldCheck className="text-white" size={17} />
            </div>
            <span className="font-bold text-[15px] tracking-tight text-white">TrustGuard</span>
          </a>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-[13px] text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.04] transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
            <div className="w-px h-5 bg-white/[0.08] mx-2" />
            <button
              onClick={onLogin}
              className="flex items-center gap-2 text-[13px] font-semibold text-white bg-[#3b82f6] hover:bg-[#2563eb] px-4 py-2 rounded-lg transition-colors duration-200"
            >
              <LogIn size={14} />
              Sign In
            </button>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/[0.06] transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 top-14 z-40 bg-[#09090b]/98 backdrop-blur-2xl md:hidden"
          >
            <div className="flex flex-col items-center pt-16 gap-2 px-6">
              {navLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-4 text-lg font-medium text-zinc-300 hover:text-white rounded-xl hover:bg-white/[0.04] transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="w-full h-px bg-white/[0.06] my-4" />
              <button
                onClick={() => { onLogin(); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 text-[15px] font-semibold text-white bg-[#3b82f6] hover:bg-[#2563eb] py-4 rounded-xl transition-colors"
              >
                <LogIn size={16} />
                Sign In
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────── */}
      {/*  HERO                                           */}
      {/* ──────────────────────────────────────────────── */}
      <section className="relative pt-32 sm:pt-36 md:pt-40 pb-16 sm:pb-24 min-h-[90vh] flex flex-col items-center justify-center">
        {/* Subtle background accent */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/[0.04] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-[800px] w-full mx-auto px-5 sm:px-8 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] mb-8"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[12px] font-medium text-zinc-400">Trusted by 200+ organizations</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.25rem] font-extrabold tracking-tight text-white leading-[1.08] mb-5"
          >
            Detect deepfakes{' '}
            <br className="hidden sm:block" />
            <span className="text-[#3b82f6]">before they spread</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease }}
            className="text-base sm:text-lg text-zinc-400 mb-10 max-w-[560px] mx-auto leading-relaxed"
          >
            Enterprise-grade AI verification for video, audio, and images. Catch manipulated media in seconds.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full"
          >
            <button
              onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto px-7 py-3.5 bg-[#3b82f6] hover:bg-[#2563eb] rounded-xl text-[14px] font-semibold text-white transition-colors duration-200 flex items-center justify-center gap-2"
            >
              Try Demo
              <ArrowRight size={15} />
            </button>
            <button
              onClick={onLogin}
              className="w-full sm:w-auto px-7 py-3.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.14] rounded-xl text-[14px] font-medium text-zinc-300 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <LogIn size={14} />
              Sign In
            </button>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-8 z-10 hidden sm:block"
        >
          <ChevronDown size={22} className="text-zinc-600" />
        </motion.div>
      </section>

      {/* ──────────────────────────────────────────────── */}
      {/*  LIVE DEMO                                      */}
      {/* ──────────────────────────────────────────────── */}
      <section id="demo" className="py-20 sm:py-28 border-t border-white/[0.04]">
        <div className="max-w-[1080px] mx-auto px-5 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
          >
            {/* Section header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/[0.08] border border-blue-500/[0.15] mb-4">
                <ScanSearch size={14} className="text-blue-400" />
                <span className="text-[12px] font-semibold text-blue-300">Live Analysis</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3">
                See it in action
              </h2>
              <p className="text-zinc-400 text-[15px] max-w-lg mx-auto">
                Upload media to run it through our AI forensic pipeline. Results appear in real-time.
              </p>

              {/* Mode Switcher */}
              <div className="flex items-center justify-center gap-1 mt-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit mx-auto">
                <button
                  onClick={() => switchMode("image")}
                  className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 flex items-center gap-2 ${
                    demoMode === "image"
                      ? "bg-white/[0.08] text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <ScanSearch size={14} />
                  Image
                </button>
                <button
                  onClick={() => switchMode("audio")}
                  className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 flex items-center gap-2 ${
                    demoMode === "audio"
                      ? "bg-white/[0.08] text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Mic size={14} />
                  Audio
                </button>
              </div>
            </div>

            {/* Demo Panel */}
            <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-5 sm:p-8 lg:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

                {/* Left — Upload */}
                <div className="flex flex-col bg-[#09090b] rounded-xl border border-white/[0.06] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider">Input</span>
                  </div>

                  {demoMode === "image" ? (
                    <>
                      <UploadZone onUpload={handleAnalyzeFile} />
                      <div className="mt-4 flex justify-center">
                        <button
                          type="button"
                          onClick={runSampleAnalysis}
                          className="text-[13px] text-zinc-500 hover:text-blue-400 transition-colors flex items-center gap-1.5 py-2"
                        >
                          <PlayCircle size={13} />
                          Run with sample data
                        </button>
                      </div>
                    </>
                  ) : (
                    /* Audio upload zone */
                    <div
                      onClick={() => document.getElementById('landing-audio-input')?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleAnalyzeAudio(e.dataTransfer.files?.[0]);
                      }}
                      className="group border-2 border-dashed border-white/[0.08] rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.12] min-h-[180px] py-8"
                    >
                      <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.03] group-hover:border-purple-500/30 group-hover:bg-purple-500/[0.06] transition-all mb-3">
                        <Music size={24} className="text-zinc-500 group-hover:text-purple-400 transition-colors" />
                      </div>
                      <p className="text-[13px] font-medium text-zinc-300">Upload audio file to test authenticity</p>
                      <p className="text-[11px] text-zinc-600 mt-1">WAV, MP3, FLAC</p>
                      {audioFileName && demoState !== "idle" && (
                        <div className="mt-3 px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg">
                          <p className="text-[11px] text-zinc-400 font-mono truncate max-w-[200px]">{audioFileName}</p>
                        </div>
                      )}
                      <input
                        id="landing-audio-input"
                        type="file"
                        hidden
                        accept="audio/*,.wav,.mp3,.flac"
                        onChange={(e) => handleAnalyzeAudio(e.target.files?.[0])}
                      />
                    </div>
                  )}
                </div>

                {/* Right — Results */}
                <div className="flex flex-col items-center justify-center min-h-[300px] bg-[#09090b] rounded-xl border border-white/[0.06] p-5 relative">
                  <div className="absolute top-5 left-5 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full transition-colors ${
                      demoState === "loading" ? "bg-amber-400 animate-pulse" :
                      demoState === "done" ? "bg-emerald-400" :
                      demoState === "error" ? "bg-red-400" :
                      "bg-zinc-700"
                    }`} />
                    <span className="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider">
                      {demoState === "loading" ? "Processing" : demoState === "done" ? "Complete" : "Output"}
                    </span>
                  </div>

                  <AnimatePresence mode="wait">
                    {demoState === "idle" && (
                      <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center flex flex-col items-center mt-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                          {demoMode === "image" ? (
                            <ScanSearch size={24} className="text-zinc-600" />
                          ) : (
                            <Activity size={24} className="text-zinc-600" />
                          )}
                        </div>
                        <p className="text-[13px] text-zinc-500">
                          {demoMode === "image" ? "Awaiting Target Media" : "Awaiting audio input"}
                        </p>
                        <p className="text-[12px] text-zinc-600 mt-1.5">
                          {demoMode === "image" ? "or use sample data" : "Upload WAV, MP3, or FLAC"}
                        </p>
                      </motion.div>
                    )}

                    {demoState === "loading" && demoMode === "image" && (
                      <motion.div key="loading-img" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm mt-8 px-2">
                        <p className="text-center text-[13px] text-zinc-400 mb-4">Processing forensic analysis…</p>
                        <AnalysisTimeline steps={[
                          { id: 1, name: "Data Ingestion", status: "completed", details: "File hash verified." },
                          { id: 2, name: "Frame Extraction", status: "completed", details: "240 frames sampled." },
                          { id: 3, name: "Frequency Analysis", status: "loading", details: "Running analysis..." },
                          { id: 4, name: "Verdict Generation", status: "pending" }
                        ]} />
                      </motion.div>
                    )}

                    {demoState === "loading" && demoMode === "audio" && (
                      <motion.div key="loading-audio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center flex flex-col items-center mt-4">
                        <div className="w-10 h-10 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4"></div>
                        <p className="text-[13px] text-zinc-300 font-medium">Analyzing audio…</p>
                        <p className="text-[12px] text-zinc-500 mt-1">Spectral pattern analysis in progress</p>
                      </motion.div>
                    )}

                    {demoState === "error" && (
                      <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center flex flex-col items-center mt-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                          <AlertCircle size={24} className="text-red-400" />
                        </div>
                        <p className="text-[13px] text-zinc-500">Analysis failed. Try again.</p>
                        <button
                          type="button"
                          onClick={resetDemo}
                          className="mt-6 px-5 py-2.5 border border-white/[0.08] hover:border-white/[0.14] rounded-lg text-[13px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all"
                        >
                          Reset
                        </button>
                      </motion.div>
                    )}

                    {/* Image result */}
                    {demoState === "done" && demoMode === "image" && analyzeResult && resultForCard && (
                      <motion.div key="done-img" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center w-full mt-8">
                        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center items-center">
                          <ResultCard result={resultForCard} />
                          <RiskGauge score={analyzeResult.score} label={analyzeResult.label} />
                        </div>
                        {analyzeResult.heatmap_url ? (
                          <img
                            src={`${API_BASE}${analyzeResult.heatmap_url}`}
                            alt="Explanation heatmap"
                            className="mt-6 max-w-xs w-full rounded-lg border border-white/[0.08] object-contain"
                          />
                        ) : null}
                        <button
                          type="button"
                          onClick={resetDemo}
                          className="mt-6 px-5 py-2.5 border border-white/[0.08] hover:border-white/[0.14] rounded-lg text-[13px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all"
                        >
                          Reset
                        </button>
                      </motion.div>
                    )}

                    {/* Audio result */}
                    {demoState === "done" && demoMode === "audio" && audioResult && (
                      <motion.div key="done-audio" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center w-full mt-8 space-y-4">
                        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                            <p className="text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider font-medium">Verdict</p>
                            <p className={`text-2xl font-bold ${
                              (audioResult.label || audioResult.verdict) === "REAL" ? 'text-emerald-500' : 'text-red-500'
                            }`}>
                              {audioResult.label || audioResult.verdict || "—"}
                            </p>
                          </div>
                          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                            <p className="text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider font-medium">Confidence</p>
                            <p className="text-2xl font-bold text-white font-mono">
                              {(audioResult.score ?? audioResult.confidence) != null
                                ? `${((audioResult.score ?? audioResult.confidence) * 100).toFixed(1)}%`
                                : "—"}
                            </p>
                          </div>
                        </div>
                        <div className={`w-full max-w-sm px-4 py-3 rounded-xl border text-[13px] font-semibold text-center flex items-center justify-center gap-2 ${
                          (audioResult.label || audioResult.verdict) === "REAL"
                            ? "bg-emerald-500/[0.08] border-emerald-500/[0.2] text-emerald-400"
                            : "bg-red-500/[0.08] border-red-500/[0.2] text-red-400"
                        }`}>
                          {(audioResult.label || audioResult.verdict) === "REAL" ? (
                            <><CheckCircle2 size={14} /> Audio appears authentic</>
                          ) : (
                            <><AlertCircle size={14} /> Synthetic audio detected</>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={resetDemo}
                          className="px-5 py-2.5 border border-white/[0.08] hover:border-white/[0.14] rounded-lg text-[13px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all"
                        >
                          Reset
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Post-demo CTA */}
            <div className="mt-8 text-center">
              <button
                onClick={onLogin}
                className="inline-flex items-center gap-2 text-[14px] text-blue-400 hover:text-blue-300 transition-colors font-medium py-3"
              >
                <LogIn size={15} />
                <span>Sign in for full dashboard access</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────── */}
      {/*  THE PROBLEM                                    */}
      {/* ──────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 border-t border-white/[0.04] bg-[#0c0c0e]">
        <div className="max-w-[1080px] mx-auto px-5 sm:px-8 flex flex-col lg:flex-row gap-12 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="lg:w-1/2 w-full"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/[0.08] border border-red-500/[0.15] mb-5">
              <AlertCircle size={14} className="text-red-400" />
              <span className="text-[12px] font-semibold text-red-300">The Problem</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-5 text-white leading-tight">
              Deepfakes are now <br />
              <span className="text-red-400">indistinguishable</span> from reality
            </h2>
            <p className="text-zinc-400 leading-relaxed text-[15px] mb-6">
              Modern generative AI produces synthetic media that fools the human eye 94% of the time. These are being weaponized for fraud, misinformation, and identity theft.
            </p>
            <div className="space-y-3">
              {[
                "4.7M deepfakes detected online in 2025 — a 550% increase",
                "Financial losses from synthetic fraud exceeded $25B globally",
                "Human detection accuracy has dropped below 48%"
              ].map((stat, i) => (
                <div key={i} className="flex items-start gap-3 text-[14px] text-zinc-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 flex-shrink-0" />
                  <span>{stat}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:w-1/2 w-full"
          >
            <div className="relative aspect-video rounded-2xl overflow-hidden border border-red-500/[0.12] bg-[#111113] p-8 flex flex-col items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.03] to-transparent" />
              <motion.div
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 3 }}
              >
                <AlertCircle size={44} className="text-red-500/60 mb-4 relative z-10" />
              </motion.div>
              <p className="relative z-10 text-red-400 font-semibold text-lg mb-2">Trust cannot be visual</p>
              <p className="relative z-10 text-zinc-500 text-[14px] text-center max-w-sm">
                The human eye can no longer reliably distinguish real from synthetic. Computational verification is essential.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────── */}
      {/*  FEATURES                                       */}
      {/* ──────────────────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28 border-t border-white/[0.04]">
        <div className="max-w-[1080px] mx-auto px-5 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/[0.08] border border-blue-500/[0.15] mb-4">
                <Cpu size={14} className="text-blue-400" />
                <span className="text-[12px] font-semibold text-blue-300">Detection Engine</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 text-white">Multi-modal forensic analysis</h2>
              <p className="text-zinc-400 text-[15px] max-w-lg mx-auto">
                Three specialized AI engines work in parallel to analyze every dimension of your media.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Video */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="group bg-[#111113] border border-white/[0.06] rounded-xl p-6 hover:border-blue-500/[0.2] transition-all duration-300"
              >
                <div className="h-40 rounded-lg bg-[#09090b] border border-white/[0.04] mb-6 relative overflow-hidden flex items-center justify-center">
                  {[0, 1, 2].map((idx) => (
                    <motion.div
                      key={idx}
                      animate={{ y: [30, 0, -30], opacity: [0, 1, 0], scale: [0.9, 1, 0.9] }}
                      transition={{ duration: 3, repeat: Infinity, delay: idx * 1, ease: "linear" }}
                      className="absolute w-24 h-16 border border-blue-500/20 rounded bg-[#0e0e10] flex items-center justify-center"
                    >
                      <PlayCircle size={14} className="text-blue-500/30" />
                    </motion.div>
                  ))}
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-2 flex items-center gap-2">
                  <PlayCircle size={16} className="text-blue-400" />
                  Video Detection
                </h3>
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  Frame-level analysis detects facial inconsistencies, motion artifacts, and GAN signatures.
                </p>
              </motion.div>

              {/* Audio */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="group bg-[#111113] border border-white/[0.06] rounded-xl p-6 hover:border-purple-500/[0.2] transition-all duration-300"
              >
                <div className="h-40 rounded-lg bg-[#09090b] border border-white/[0.04] mb-6 relative overflow-hidden flex items-end justify-center pb-6 px-3 gap-[3px]">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: ["12%", `${Math.random() * 60 + 20}%`, "12%"] }}
                      transition={{ duration: Math.random() * 0.7 + 0.4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: i * 0.04 }}
                      className="w-full max-w-[5px] bg-purple-500/40 rounded-t-sm"
                    />
                  ))}
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-2 flex items-center gap-2">
                  <Activity size={16} className="text-purple-400" />
                  Audio Analysis
                </h3>
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  Spectral analysis detects synthetic voice patterns, vocoder artifacts, and TTS signatures.
                </p>
              </motion.div>

              {/* Image */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="group bg-[#111113] border border-white/[0.06] rounded-xl p-6 hover:border-emerald-500/[0.2] transition-all duration-300 md:col-span-2 lg:col-span-1"
              >
                <div className="h-40 rounded-lg bg-[#09090b] border border-white/[0.04] mb-6 relative overflow-hidden flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-800/60 border-2 border-zinc-700/40 relative overflow-hidden">
                    <motion.div
                      animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
                      transition={{ duration: 5, repeat: Infinity }}
                      className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.5)_0%,rgba(245,158,11,0.25)_50%,transparent_100%)] mix-blend-color-dodge"
                    />
                  </div>
                  <motion.div
                    animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
                    transition={{ duration: 5, repeat: Infinity }}
                    className="absolute top-[25%] right-[32%] w-4 h-4 rounded-full border border-emerald-400/60 flex items-center justify-center z-30"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  </motion.div>
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-2 flex items-center gap-2">
                  <ScanSearch size={16} className="text-emerald-400" />
                  Image Forensics
                </h3>
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  Spatial artifact detection identifies diffusion model traces and pixel-level manipulation.
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────── */}
      {/*  SOLUTION / CAPABILITIES                        */}
      {/* ──────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 border-t border-white/[0.04] bg-[#0c0c0e]">
        <div className="max-w-[1080px] mx-auto px-5 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/[0.15] mb-4">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span className="text-[12px] font-semibold text-emerald-300">Our Solution</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 text-white">
              Neural verification at every layer
            </h2>
            <p className="text-zinc-400 text-[15px] max-w-xl mx-auto">
              TrustGuard analyzes media at the pixel, frequency, and temporal levels to identify invisible fingerprints.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: <ScanSearch size={20} />, title: "Computer Vision", desc: "Proprietary CNNs trained on manipulated datasets to detect visual forgery.", colorClass: "text-blue-400 bg-blue-500/[0.08]" },
              { icon: <Activity size={20} />, title: "Temporal Signals", desc: "Analyzes frame-to-frame variations to detect unrealistic physics.", colorClass: "text-purple-400 bg-purple-500/[0.08]" },
              { icon: <Fingerprint size={20} />, title: "Biometric Check", desc: "Pinpoints unnatural blending and morphing artifacts in faces.", colorClass: "text-emerald-400 bg-emerald-500/[0.08]" },
              { icon: <ShieldCheck size={20} />, title: "Confidence Score", desc: "Provides a forensic confidence score quantifying manipulation probability.", colorClass: "text-amber-400 bg-amber-500/[0.08]" }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="p-5 rounded-xl bg-[#111113] border border-white/[0.06] hover:border-white/[0.1] transition-all duration-300"
              >
                <div className={`w-10 h-10 rounded-lg ${feature.colorClass} flex items-center justify-center mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-[14px] font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-[13px] text-zinc-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────── */}
      {/*  HOW IT WORKS                                   */}
      {/* ──────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28 border-t border-white/[0.04]">
        <div className="max-w-[1080px] mx-auto px-5 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/[0.08] border border-blue-500/[0.15] mb-4">
                <Layers size={14} className="text-blue-400" />
                <span className="text-[12px] font-semibold text-blue-300">Pipeline</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 text-white">How it works</h2>
              <p className="text-zinc-400 text-[15px] max-w-lg mx-auto">
                Four stages from upload to verdict — all in under a second.
              </p>
            </div>

            <div className="relative flex flex-col md:flex-row justify-between items-stretch gap-8 md:gap-4">
              {/* Connecting line — desktop */}
              <div className="hidden md:block absolute top-[42px] left-[12%] right-[12%] h-px bg-zinc-800 z-0">
                <motion.div
                  initial={{ width: "0%" }}
                  whileInView={{ width: "100%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  className="h-full bg-gradient-to-r from-blue-500/60 to-purple-500/60"
                />
              </div>

              {[
                { step: "01", title: "Upload Media", icon: <Database size={20} />, desc: "Drag & drop any file" },
                { step: "02", title: "Frame Extraction", icon: <Layers size={20} />, desc: "Intelligent sampling" },
                { step: "03", title: "Neural Analysis", icon: <Cpu size={20} />, desc: "Multi-model ensemble" },
                { step: "04", title: "Verdict", icon: <ShieldCheck size={20} />, desc: "Confidence score output" }
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.15 }}
                  className="relative flex flex-row md:flex-col items-center md:text-center z-10 flex-1 gap-4 md:gap-0"
                >
                  <div className="w-16 h-16 rounded-xl bg-[#111113] border border-white/[0.06] flex items-center justify-center md:mb-5 text-blue-400 flex-shrink-0">
                    {s.icon}
                  </div>
                  <div className="flex flex-col md:items-center">
                    <span className="text-[11px] font-semibold text-blue-400 mb-1.5 tracking-wider">Step {s.step}</span>
                    <h3 className="text-[14px] font-semibold text-white mb-0.5">{s.title}</h3>
                    <p className="text-[12px] text-zinc-500">{s.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────── */}
      {/*  CTA                                            */}
      {/* ──────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 border-t border-white/[0.04]">
        <div className="max-w-[680px] mx-auto px-5 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-8 sm:p-12 lg:p-16 relative overflow-hidden">
              {/* Top accent line */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

              <ShieldCheck size={28} className="text-blue-400 mx-auto mb-5" />
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-white">
                Ready to verify authenticity?
              </h2>
              <p className="text-zinc-400 text-[15px] mb-8 max-w-md mx-auto">
                Sign in for full dashboard access — scan history, API access, batch processing, and team collaboration.
              </p>
              <button
                onClick={onLogin}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#3b82f6] hover:bg-[#2563eb] rounded-xl text-[14px] font-semibold text-white transition-colors duration-200 flex items-center justify-center gap-2 mx-auto"
              >
                <LogIn size={15} />
                Sign In to Dashboard
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────── */}
      {/*  FOOTER                                         */}
      {/* ──────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] bg-[#0c0c0e]">
        <div className="max-w-[1080px] mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-[13px] text-zinc-500">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#3b82f6] flex items-center justify-center">
              <ShieldCheck size={14} className="text-white" />
            </div>
            <span className="font-semibold text-zinc-400">TrustGuard</span>
          </div>
          <p className="text-zinc-600">© {new Date().getFullYear()} TrustGuard. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">API Docs</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}