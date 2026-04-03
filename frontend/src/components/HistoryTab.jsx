import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, Search, Filter, Clock, Image, Mic, Video, ShieldCheck, RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { fetchHistory } from "../api";

const TYPE_ICON = { image: Image, audio: Mic, video: Video, live: ShieldCheck };
const TYPE_COLOR = {
  image:  "bg-blue-50 text-blue-600 border-blue-100",
  audio:  "bg-purple-50 text-purple-600 border-purple-100",
  video:  "bg-orange-50 text-orange-600 border-orange-100",
  live:   "bg-green-50 text-green-600 border-green-100",
};

function timeAgo(ts) {
  if (!ts) return "—";
  const d = new Date(ts.seconds ? ts.seconds * 1000 : ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function HistoryTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | REAL | FAKE

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHistory();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Could not load history.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter(item => {
    const matchFilter = filter === "all" || item.label === filter;
    const matchSearch = !search || (item.file_name || item.fileName || "").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-gray-900 dark:text-white">Analysis History</h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">All past deepfake analyses linked to your account.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by filename…"
            className="w-full pl-8 pr-4 py-2 text-[13px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>
        <div className="flex gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-1">
          {["all","REAL","FAKE"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                filter === f
                  ? f === "FAKE" ? "bg-red-600 text-white"
                  : f === "REAL" ? "bg-green-600 text-white"
                  : "bg-blue-600 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}>
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-[13px] text-gray-400">Loading history…</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-center px-6">
            <div>
              <AlertCircle size={28} className="mx-auto mb-3 text-red-400" />
              <p className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">{error}</p>
              <p className="text-[12px] text-gray-400 mt-1">Make sure you're signed in and have past analyses.</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-center px-6">
            <div>
              <History size={28} className="mx-auto mb-3 text-gray-300" />
              <p className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">
                {items.length === 0 ? "No analyses yet" : "No results match your filter"}
              </p>
              <p className="text-[12px] text-gray-400 mt-1">
                {items.length === 0 ? "Upload your first file to get started." : "Try adjusting your search or filter."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <div className="col-span-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">File</div>
              <div className="col-span-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Type</div>
              <div className="col-span-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Result</div>
              <div className="col-span-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Confidence</div>
              <div className="col-span-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Time</div>
            </div>
            <AnimatePresence>
              {filtered.map((item, i) => {
                const mediaType = item.media_type || item.type || "image";
                const TypeIcon = TYPE_ICON[mediaType] || Image;
                const label = item.label || "—";
                const conf = ((item.confidence ?? item.score ?? 0) * 100).toFixed(1);
                return (
                  <motion.div key={item.job_id || i}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors items-center">
                    <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                        <TypeIcon size={13} className="text-gray-500 dark:text-gray-400" />
                      </div>
                      <span className="text-[13px] text-gray-800 dark:text-gray-200 font-medium truncate">
                        {item.file_name || item.fileName || item.job_id?.slice(0, 12) || "—"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TYPE_COLOR[mediaType] || TYPE_COLOR.image}`}>
                        {mediaType}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1 text-[12px] font-bold ${
                        label === "REAL" ? "text-green-600" :
                        label === "FAKE" ? "text-red-600" : "text-gray-400"
                      }`}>
                        {label === "REAL" ? <CheckCircle2 size={12} /> :
                         label === "FAKE" ? <XCircle size={12} /> : null}
                        {label}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${label === "FAKE" ? "bg-red-500" : "bg-green-500"}`}
                            style={{ width: `${conf}%` }} />
                        </div>
                        <span className="text-[12px] font-mono text-gray-600 dark:text-gray-400 w-10 flex-shrink-0">{conf}%</span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span className="flex items-center gap-1 text-[12px] text-gray-400">
                        <Clock size={11} />
                        {timeAgo(item.created_at || item.timestamp)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-[12px] text-gray-400 text-center">
          Showing {filtered.length} of {items.length} analyses
        </p>
      )}
    </div>
  );
}
