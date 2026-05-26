"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 32,
      }}
    >
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 400, textAlign: "center" }}>
        {error.message || "An unexpected error occurred."}
      </div>
      <button
        className="btn btn-ghost btn-sm"
        onClick={reset}
        style={{ marginTop: 8 }}
      >
        Try again
      </button>
    </div>
  );
}
