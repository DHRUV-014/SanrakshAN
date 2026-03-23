export default function ResultCard({ result }) {
  if (!result) return null;

  const labelColorClass =
    result.label === "FAKE"
      ? "text-red-500"
      : result.label === "REAL"
      ? "text-emerald-500"
      : "text-amber-400";

  return (
    <div className="w-full max-w-[420px]">
      <h2 className="mb-1.5 text-lg sm:text-xl font-bold text-white">
        Result: <span className={labelColorClass}>{result.label}</span>
      </h2>

      <p className="text-[14px] text-zinc-300">
        Confidence: <strong>{(result.score * 100).toFixed(1)}%</strong>
      </p>

      <p className="text-[13px] text-zinc-500 mt-1">
        Faces Detected: <strong>{result.faces_detected}</strong>
      </p>
    </div>
  );
}