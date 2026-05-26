"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#0d0d14",
          color: "#eee",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          gap: 16,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>AdPilot — Critical Error</div>
        <div style={{ fontSize: 14, color: "#aaa", maxWidth: 400 }}>
          {error.message || "A critical error occurred. Please refresh."}
        </div>
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            padding: "8px 20px",
            background: "#c96a00",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Retry
        </button>
      </body>
    </html>
  );
}
