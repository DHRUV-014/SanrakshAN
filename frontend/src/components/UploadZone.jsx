import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, FileCode, ShieldAlert } from "lucide-react";

const UploadZone = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = (file) => {
    if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
      onUpload(file);
    }
  };

  return (
    <motion.div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
      onClick={() => fileInputRef.current?.click()}
      className={`relative group w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-200 overflow-hidden min-h-[160px] sm:min-h-[180px] py-8 sm:py-10
        ${isDragging
          ? "border-blue-500/50 bg-blue-500/[0.06]"
          : "border-white/[0.08] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.12]"
        }`}
    >
      <motion.div
        animate={isDragging ? { y: -6 } : { y: 0 }}
        className={`p-3 sm:p-4 rounded-xl border transition-all duration-200 mb-3
          ${isDragging
            ? "bg-blue-500 border-blue-400"
            : "bg-white/[0.03] border-white/[0.06] group-hover:border-blue-500/30 group-hover:bg-blue-500/[0.06]"
          }`}
      >
        <Upload
          size={24}
          className={`sm:hidden ${isDragging ? "text-white" : "text-zinc-500 group-hover:text-blue-400"} transition-colors`}
        />
        <Upload
          size={28}
          className={`hidden sm:block ${isDragging ? "text-white" : "text-zinc-500 group-hover:text-blue-400"} transition-colors`}
        />
      </motion.div>

      <div className="text-center z-10 px-4">
        <p className="text-[13px] font-medium text-zinc-300">
          {isDragging ? "Drop to upload" : "Drop file or click to browse"}
        </p>

        <div className="flex items-center justify-center gap-3 mt-2">
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
            <FileCode size={11} />
            H.264 / RAW
          </span>
          <span className="w-1 h-1 rounded-full bg-white/[0.08]" />
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
            <ShieldAlert size={11} />
            Metadata-Safe
          </span>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        hidden
        accept="image/*,video/*"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </motion.div>
  );
};

export default UploadZone;