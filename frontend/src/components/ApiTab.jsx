import { useState } from "react";
import { motion } from "framer-motion";
import { Code, Copy, Check, Key, Terminal, Globe, Zap, Lock, ChevronDown, ChevronUp } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "https://trustguard-5olg.onrender.com";
const MOCK_KEY = "tg_live_sk_7f3a2e9b1c4d8f2a6e0b5c3d9a7f1e4";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-[11px] font-medium transition-colors">
      {copied ? <><Check size={11} className="text-green-400" /> Copied</> : <><Copy size={11} /> Copy</>}
    </button>
  );
}

function CodeBlock({ code, lang = "bash" }) {
  return (
    <div className="relative group">
      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900">
          <span className="text-[11px] text-gray-500 font-mono">{lang}</span>
          <CopyButton text={code} />
        </div>
        <pre className="p-4 text-[12px] text-gray-300 font-mono leading-relaxed overflow-x-auto whitespace-pre">{code}</pre>
      </div>
    </div>
  );
}

const ENDPOINTS = [
  {
    method: "POST",
    path: "/analyze",
    desc: "Detect deepfakes in images and videos",
    params: [{ name: "file", type: "File", required: true, desc: "Image (PNG/JPG) or video (MP4/MOV/AVI)" }],
    response: `{
  "job_id": "7f3a2e9b...",
  "status": "completed",
  "label": "FAKE",
  "score": 0.947,
  "confidence": 0.947,
  "heatmap_url": "/heatmaps/7f3a2e_heatmap.jpg",
  "explanation": "Deepfake detected with 94.7% confidence...",
  "tts_url": "/heatmaps/7f3a2e_tts.mp3"
}`,
    curl: `curl -X POST ${API_BASE}/analyze \\
  -H "Authorization: Bearer ${MOCK_KEY}" \\
  -F "file=@face.jpg"`,
    js: `const form = new FormData();
form.append("file", fileInput.files[0]);

const res = await fetch("${API_BASE}/analyze", {
  method: "POST",
  headers: { "Authorization": "Bearer YOUR_API_KEY" },
  body: form,
});
const result = await res.json();
console.log(result.label, result.score);`,
    python: `import requests

with open("face.jpg", "rb") as f:
    res = requests.post(
        "${API_BASE}/analyze",
        headers={"Authorization": "Bearer YOUR_API_KEY"},
        files={"file": f},
    )
print(res.json())`,
  },
  {
    method: "POST",
    path: "/analyze-audio",
    desc: "Detect synthetic speech in audio or video files",
    params: [{ name: "file", type: "File", required: true, desc: "Audio (WAV/MP3/FLAC/OGG) or video (MP4/MOV)" }],
    response: `{
  "label": "FAKE",
  "confidence": 0.891,
  "method": "cnn",
  "input_type": "audio",
  "processing_time": 1.24,
  "explanation": "This audio shows signs of AI synthesis...",
  "tts_url": "/heatmaps/abc123_tts.mp3"
}`,
    curl: `curl -X POST ${API_BASE}/analyze-audio \\
  -F "file=@voice.wav"`,
    js: `const form = new FormData();
form.append("file", fileInput.files[0]);

const res = await fetch("${API_BASE}/analyze-audio", {
  method: "POST",
  body: form,
});
const result = await res.json();`,
    python: `import requests

with open("voice.wav", "rb") as f:
    res = requests.post(
        "${API_BASE}/analyze-audio",
        files={"file": f},
    )
print(res.json())`,
  },
  {
    method: "GET",
    path: "/status/{job_id}",
    desc: "Poll async analysis job status",
    params: [{ name: "job_id", type: "string", required: true, desc: "Job ID returned by /analyze" }],
    response: `{
  "status": "COMPLETED",
  "label": "REAL",
  "score": 0.12,
  "confidence": 0.88,
  "heatmap_url": "/heatmaps/..._heatmap.jpg",
  "explanation": "Image appears authentic..."
}`,
    curl: `curl ${API_BASE}/status/7f3a2e9b \\
  -H "Authorization: Bearer ${MOCK_KEY}"`,
    js: `const res = await fetch(\`${API_BASE}/status/\${jobId}\`, {
  headers: { "Authorization": "Bearer YOUR_API_KEY" },
});
const status = await res.json();`,
    python: `res = requests.get(
    f"${API_BASE}/status/{job_id}",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
)`,
  },
];

function EndpointCard({ endpoint }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("curl");

  const codeMap = { curl: endpoint.curl, javascript: endpoint.js, python: endpoint.python };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left">
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${
          endpoint.method === "POST" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" :
          "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
        }`}>{endpoint.method}</span>
        <code className="text-[13px] font-mono font-semibold text-gray-800 dark:text-gray-200">{endpoint.path}</code>
        <span className="text-[12px] text-gray-500 dark:text-gray-400 ml-2 hidden sm:block">{endpoint.desc}</span>
        <div className="ml-auto">
          {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-5 space-y-5">
          {/* Parameters */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Parameters</p>
            <div className="space-y-2">
              {endpoint.params.map(p => (
                <div key={p.name} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <code className="text-[12px] font-mono font-semibold text-blue-600 dark:text-blue-400">{p.name}</code>
                  <span className="text-[11px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">{p.type}</span>
                  {p.required && <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-medium">required</span>}
                  <span className="text-[12px] text-gray-500 dark:text-gray-400">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Response */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Response</p>
            <CodeBlock code={endpoint.response} lang="json" />
          </div>

          {/* Code examples */}
          <div>
            <div className="flex items-center gap-1 mb-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mr-2">Example</p>
              {["curl", "javascript", "python"].map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    lang === l ? "bg-gray-900 dark:bg-gray-700 text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}>
                  {l}
                </button>
              ))}
            </div>
            <CodeBlock code={codeMap[lang]} lang={lang} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiTab() {
  const [keyCopied, setKeyCopied] = useState(false);

  const copyKey = () => {
    navigator.clipboard.writeText(MOCK_KEY);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-[18px] font-bold text-gray-900 dark:text-white">API Access</h1>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">Integrate SanrakshAN into any application with our REST API.</p>
      </div>

      {/* API Key */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Key size={14} className="text-blue-500" />
          <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Your API Key</span>
          <span className="ml-auto text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">Demo Key</span>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-[12px] font-mono text-gray-700 dark:text-gray-300 overflow-x-auto select-all">
            {MOCK_KEY}
          </code>
          <button onClick={copyKey}
            className="flex items-center gap-1.5 px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 text-[12px] font-medium transition-colors flex-shrink-0">
            {keyCopied ? <><Check size={13} className="text-green-500" /> Copied</> : <><Copy size={13} /> Copy</>}
          </button>
        </div>
        <p className="text-[12px] text-gray-400">Pass this key in the <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400">Authorization: Bearer</code> header for authenticated endpoints.</p>
      </div>

      {/* Base URL */}
      <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl">
        <Globe size={15} className="text-blue-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">Base URL</p>
          <code className="text-[13px] font-mono text-blue-800 dark:text-blue-300 break-all">{API_BASE}</code>
        </div>
        <CopyButton text={API_BASE} />
      </div>

      {/* Endpoints */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Endpoints</p>
        {ENDPOINTS.map(e => <EndpointCard key={e.path} endpoint={e} />)}
      </div>

      {/* Rate limits */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={14} className="text-amber-500" />
          <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Rate Limits</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[["60 req/min","Free Tier"],["600 req/min","Pro"],["Unlimited","Enterprise"]].map(([rate,tier]) => (
            <div key={tier} className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="text-[14px] font-bold text-gray-900 dark:text-white">{rate}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{tier}</div>
            </div>
          ))}
        </div>
      </div>

      {/* WhatsApp integration teaser */}
      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-green-800 dark:text-green-300 mb-1">WhatsApp Integration</p>
            <p className="text-[12px] text-green-700 dark:text-green-400 leading-relaxed">
              Send any image, audio, or video to your WhatsApp bot and get an instant deepfake verdict back — no app needed.
              Uses the WhatsApp Business Cloud API webhook. See the WhatsApp tab for setup instructions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
