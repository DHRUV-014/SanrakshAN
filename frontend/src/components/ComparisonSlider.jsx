import React from 'react';
import { Target, ScanSearch } from 'lucide-react';
import { ImgComparisonSlider } from "@img-comparison-slider/react";

const ComparisonSlider = ({ original, heatmap, isProcessing }) => {
  return (
    <div className="relative w-full aspect-video bg-gray-100 rounded-xl overflow-hidden border border-gray-200 group shadow-sm">

      <ImgComparisonSlider
        hover="true"
        className="w-full h-full outline-none"
      >
        {/* FIRST SLOT: ORIGINAL */}
        <div slot="first" className="relative w-full h-full bg-gray-50">
          <img
            src={original}
            className="w-full h-full object-contain"
            alt="Original"
          />
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-[10px] font-semibold text-blue-600 flex items-center gap-1.5 z-10 border border-blue-100 shadow-sm">
            <Target size={11} />
            <span>ORIGINAL</span>
          </div>
        </div>

        {/* SECOND SLOT: HEATMAP */}
        <div slot="second" className="relative w-full h-full bg-gray-50">
          <img
            src={heatmap || original}
            className={`w-full h-full object-contain ${!heatmap ? 'sepia hue-rotate-[240deg] saturate-[3] brightness-75' : ''}`}
            alt="AI Heatmap"
          />

          {!heatmap && (
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 via-red-500/20 to-yellow-500/20 mix-blend-color-dodge opacity-80"></div>
          )}

          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-[10px] font-semibold text-amber-600 flex items-center gap-1.5 z-10 border border-amber-100 shadow-sm">
            <ScanSearch size={11} />
            <span>GRAD-CAM</span>
          </div>
        </div>

        {/* HANDLE */}
        <div slot="handle" className="flex items-center justify-center">
          <div className="w-0.5 h-10 bg-gray-400/40 rounded-full"></div>
        </div>
      </ImgComparisonSlider>

      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-30 bg-white/70 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3 mx-auto"></div>
            <p className="text-blue-600 animate-pulse text-[11px] font-medium">Processing…</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonSlider;
