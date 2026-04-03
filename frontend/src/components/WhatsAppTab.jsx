import { useState } from "react";
import { Copy, Check, ExternalLink, Smartphone, Webhook, Bot, ArrowRight, Code, MessageCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "https://trustguard-5olg.onrender.com";
const WEBHOOK_URL = `${API_BASE}/twilio/whatsapp`;

function LightCopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 text-[11px] font-medium transition-colors flex-shrink-0"
    >
      {copied ? <><Check size={11} className="text-emerald-500" />Copied</> : <><Copy size={11} />Copy</>}
    </button>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Create a free Twilio account",
    desc: "Go to twilio.com and sign up — no credit card needed for the sandbox.",
    link: "https://www.twilio.com/try-twilio",
    linkLabel: "Sign up at Twilio →",
  },
  {
    n: "02",
    title: "Open the WhatsApp Sandbox",
    desc: "In the Twilio Console, go to Messaging → Try it out → Send a WhatsApp message. You'll see a sandbox number and join code.",
    link: "https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn",
    linkLabel: "Open WhatsApp Sandbox →",
  },
  {
    n: "03",
    title: "Connect your phone",
    desc: 'Send "join <your-sandbox-code>" to the Twilio sandbox number on WhatsApp to activate your test line.',
  },
  {
    n: "04",
    title: "Set the webhook URL",
    desc: 'In sandbox settings, paste your backend URL into the "When a message comes in" field (HTTP POST).',
    code: WEBHOOK_URL,
  },
  {
    n: "05",
    title: "Add env vars to your backend",
    desc: "Set these on your server (Render → Environment tab):",
    envVars: [
      { key: "TWILIO_ACCOUNT_SID", hint: "Found in Twilio Console dashboard" },
      { key: "TWILIO_AUTH_TOKEN",  hint: "Found in Twilio Console dashboard" },
    ],
  },
  {
    n: "06",
    title: "Send a message!",
    desc: "Send any image, audio clip, or video to the sandbox number — SanrakshAN replies with the deepfake verdict instantly.",
  },
];

export default function WhatsAppTab() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-[20px] font-bold text-gray-900 dark:text-white">WhatsApp Bot</h1>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
          Let anyone verify media by sending a WhatsApp message — no app install required.
        </p>
      </div>

      {/* Status banner */}
      <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-2xl">
        <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <MessageCircle size={16} className="text-white" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-emerald-800 dark:text-emerald-300">Powered by Twilio Sandbox</p>
          <p className="text-[12px] text-emerald-600 dark:text-emerald-400">Free · No credit card · Ready in 5 minutes</p>
        </div>
        <span className="ml-auto text-[10px] font-bold bg-emerald-500 text-white px-2.5 py-1 rounded-full">LIVE</span>
      </div>

      {/* How it works */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-5">How it works</p>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { icon: Smartphone, label: "User sends media",         color: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"   },
            { arrow: true },
            { icon: Webhook,    label: "Twilio fires webhook",     color: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400"     },
            { arrow: true },
            { icon: Bot,        label: "SanrakshAN AI analyzes",   color: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400" },
            { arrow: true },
            { icon: Smartphone, label: "Bot replies with verdict", color: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"   },
          ].map((item, i) =>
            item.arrow ? (
              <ArrowRight key={i} size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
            ) : (
              <div key={i} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl ${item.color} text-[12px] font-semibold flex-shrink-0`}>
                <item.icon size={13} />
                {item.label}
              </div>
            )
          )}
        </div>
      </div>

      {/* Example reply */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-5">Example Bot Reply</p>
        <div className="flex justify-end">
          <div className="bg-[#dcf8c6] dark:bg-emerald-900/50 rounded-2xl rounded-tr-sm px-4 py-3.5 max-w-xs shadow-sm">
            <p className="text-[13px] text-gray-800 dark:text-gray-100 leading-relaxed">
              🚨 <strong>SanrakshAN Analysis</strong><br />
              Type: image<br />
              Verdict: <strong>FAKE</strong><br />
              Confidence: 94.7%<br /><br />
              <em className="text-[12px] text-gray-600 dark:text-gray-300">
                Deepfake detected with 94.7% confidence. Manipulation artifacts around facial boundaries...
              </em>
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right mt-2">SanrakshAN · just now ✓✓</p>
          </div>
        </div>
      </div>

      {/* Webhook URL */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Your Webhook URL</p>
        <div className="flex items-center gap-2 p-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <code className="flex-1 text-[12px] font-mono text-gray-700 dark:text-gray-300 break-all">{WEBHOOK_URL}</code>
          <LightCopyButton text={WEBHOOK_URL} />
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Paste into the Twilio sandbox "When a message comes in" field as HTTP POST.</p>
      </div>

      {/* Setup steps */}
      <div className="space-y-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Setup Guide</p>
        {STEPS.map((step) => (
          <div key={step.n} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-gray-900 dark:bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-700">
                <span className="text-[11px] font-bold text-white">{step.n}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-900 dark:text-white mb-1">{step.title}</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                {step.code && (
                  <div className="mt-3 flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <code className="flex-1 text-[12px] font-mono text-gray-700 dark:text-gray-300 break-all">{step.code}</code>
                    <LightCopyButton text={step.code} />
                  </div>
                )}
                {step.envVars && (
                  <div className="mt-3 space-y-2">
                    {step.envVars.map(({ key, hint }) => (
                      <div key={key} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <code className="text-[12px] font-mono font-bold text-blue-600 dark:text-blue-400">{key}</code>
                        <span className="text-[11px] text-gray-400 flex-1">{hint}</span>
                        <LightCopyButton text={key} />
                      </div>
                    ))}
                  </div>
                )}
                {step.link && (
                  <a href={step.link} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2.5 text-[12px] text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                    {step.linkLabel} <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Supported types */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { emoji: "🖼️", label: "Images", desc: "JPG · PNG · WebP" },
          { emoji: "🎵", label: "Audio",  desc: "OGG · MP3 · WAV"  },
          { emoji: "🎬", label: "Videos", desc: "MP4 · MOV · 3GP"  },
        ].map(item => (
          <div key={item.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 text-center shadow-sm">
            <div className="text-2xl mb-2">{item.emoji}</div>
            <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200">{item.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Endpoint info */}
      <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800 bg-gray-900/80">
          <div className="flex items-center gap-2">
            <Code size={13} className="text-gray-400" />
            <span className="text-[12px] text-gray-400 font-mono">POST /twilio/whatsapp — already wired up</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-emerald-400 font-semibold">Active</span>
          </div>
        </div>
        <pre className="p-5 text-[12px] text-gray-300 font-mono leading-relaxed overflow-x-auto">{`# Twilio sends a form POST with:
#   From         = whatsapp:+1234567890
#   NumMedia     = 1
#   MediaUrl0    = https://api.twilio.com/...
#   MediaContentType0 = image/jpeg

# SanrakshAN downloads the media, runs ML,
# and returns TwiML with the verdict.

# TwiML response:
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>
    🚨 SanrakshAN Analysis
    Type: image
    Verdict: FAKE
    Confidence: 94.7%

    Deepfake detected with 94.7% confidence...
  </Message>
</Response>`}</pre>
      </div>
    </div>
  );
}
