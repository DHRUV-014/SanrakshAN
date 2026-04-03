export default function ResultCard({ result }) {
  if (!result) return null;

  const labelColorClass =
    result.label === "FAKE"
      ? "text-red-600"
      : result.label === "REAL"
      ? "text-green-600"
      : "text-amber-600";

  return (
    <div className="w-full max-w-[420px]">
      <h2 className="mb-1.5 text-lg sm:text-xl font-bold text-gray-900">
        Result: <span className={labelColorClass}>{result.label}</span>
      </h2>

      <p className="text-[14px] text-gray-600">
        Confidence: <strong className="text-gray-900">{(result.score * 100).toFixed(1)}%</strong>
      </p>

      <p className="text-[13px] text-gray-500 mt-1">
        Faces Detected: <strong className="text-gray-700">{result.faces_detected}</strong>
      </p>
    </div>
  );
}
