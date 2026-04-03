import React from 'react';
import { CheckCircle2, Circle, Loader2, AlertCircle } from 'lucide-react';

const AnalysisTimeline = ({ steps }) => {
  return (
    <div className="space-y-5">
      {steps.map((step, index) => (
        <div key={step.id} className="relative pl-8 group">
          {/* Connector */}
          {index !== steps.length - 1 && (
            <div className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200"></div>
          )}

          {/* Status Icon */}
          <div className="absolute left-0 top-0.5">
            {step.status === 'completed' && <CheckCircle2 size={22} className="text-green-500" />}
            {step.status === 'loading' && <Loader2 size={22} className="text-blue-600 animate-spin" />}
            {step.status === 'pending' && <Circle size={22} className="text-gray-300" />}
            {step.status === 'error' && <AlertCircle size={22} className="text-red-500" />}
          </div>

          <div className="flex flex-col">
            <span className={`text-[13px] font-semibold tracking-wide ${
              step.status === 'loading' ? 'text-blue-600' :
              step.status === 'completed' ? 'text-gray-800' : 'text-gray-400'
            }`}>
              {step.name}
            </span>
            {step.details && (
              <span className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                {step.details}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AnalysisTimeline;
