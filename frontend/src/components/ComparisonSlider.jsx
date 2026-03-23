import React from 'react';
import { Target, ScanSearch } from 'lucide-react';
import { ImgComparisonSlider } from "@img-comparison-slider/react";

const ComparisonSlider = ({ original, heatmap, isProcessing }) => {
  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-white/[0.06] group">
      
      <ImgComparisonSlider
        hover="true"
        className="w-full h-full outline-none"
      >
        {/* FIRST SLOT: ORIGINAL */}
        <div slot="first" className="relative w-full h-full bg-black">
          <img 
            src={original} 
            className="w-full h-full object-contain" 
            alt="Original" 
          />
          <div className="absolute top-3 left-3 glass px-2.5 py-1 rounded-md text-[10px] font-semibold text-blue-400 flex items-center gap-1.5 z-10">
            <Target size={11} />
            <span>ORIGINAL</span>
          </div>
        </div>

        {/* SECOND SLOT: HEATMAP */}
        <div slot="second" className="relative w-full h-full bg-black">
          <img 
            src={heatmap || original} 
            className={`w-full h-full object-contain ${!heatmap ? 'sepia hue-rotate-[240deg] saturate-[3] brightness-75' : ''}`} 
            alt="AI Heatmap" 
          />
          
          {!heatmap && (
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 via-red-500/20 to-yellow-500/20 mix-blend-color-dodge opacity-80"></div>
          )}
          
          <div className="absolute top-3 right-3 glass px-2.5 py-1 rounded-md text-[10px] font-semibold text-amber-400 flex items-center gap-1.5 z-10">
            <ScanSearch size={11} />
            <span>GRAD-CAM</span>
          </div>
        </div>

        {/* HANDLE */}
        <div slot="handle" className="flex items-center justify-center">
            <div className="w-0.5 h-10 bg-white/20 rounded-full"></div>
        </div>
      </ImgComparisonSlider>

      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center">
                <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-3 mx-auto"></div>
                <p className="text-blue-400 animate-pulse text-[11px] font-medium">
                  Processing...
                </p>
            </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonSlider;