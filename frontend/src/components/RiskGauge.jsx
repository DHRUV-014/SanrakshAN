import React, { useEffect, useState } from "react";

const RiskGauge = ({ score, label }) => {
  const REAL_CEILING = 0.8926;

  let percent;
  let color;
  let text;
  let subText = "Forensic Confidence";

  if (label === "REAL") {
    if (score > 0.5) {
      percent = 50;
      color = "#f59e0b";
      text = "SUSPICIOUS";
      subText = "High Noise / Possible AI";
    } else {
      const safety = (REAL_CEILING - score) / REAL_CEILING;
      percent = Math.round(Math.max(0, safety * 100));
      color = "#16a34a";
      text = "AUTHENTIC";
    }
  } else {
    const danger = (score - REAL_CEILING) / (1 - REAL_CEILING);
    percent = Math.round(Math.max(0, danger * 100));
    color = "#dc2626";
    text = "SYNTHETIC";
  }

  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(percent), 200);
    return () => clearTimeout(t);
  }, [percent]);

  const radius = 85;
  const circumference = Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;
  const rotation = (animated / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center w-full max-w-[220px] sm:max-w-[240px] p-4 sm:p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
      <svg viewBox="0 0 200 140" className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Track */}
        <path d="M 20 120 A 80 80 0 0 1 180 120" fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />

        {/* Fill */}
        <path
          d="M 20 120 A 80 80 0 0 1 180 120"
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />

        {/* Needle */}
        <g transform={`rotate(${rotation}, 100, 120)`} className="transition-transform duration-1000 ease-out">
          <line x1="100" y1="120" x2="100" y2="40" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="100" cy="120" r="3.5" fill="#374151" />
        </g>

        <text x="100" y="85" textAnchor="middle" className="fill-gray-900 font-bold text-3xl tabular-nums">
          {animated}%
        </text>
        <text x="100" y="108" textAnchor="middle" className="font-semibold text-[10px] tracking-[0.2em]" style={{ fill: color }}>
          {text}
        </text>
      </svg>

      <div className="mt-3 w-full border-t border-gray-100 pt-3 flex flex-col items-center gap-1">
        <span className="text-[9px] text-gray-400 font-medium tracking-wider">{subText}</span>
        <div className="text-[11px] font-mono text-gray-500">
          Score: <span className="text-gray-900 font-semibold">{(score * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};

export default RiskGauge;
