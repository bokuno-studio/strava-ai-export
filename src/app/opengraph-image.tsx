import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f7f4ef",
          color: "#17202a",
          fontFamily: "Inter, Arial, sans-serif",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              width: 96,
              height: 96,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              background: "#fc4c02",
              color: "white",
              fontSize: 54,
              fontWeight: 800,
            }}
          >
            S
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02 }}>
              Strava AI Export
            </div>
            <div style={{ marginTop: 28, maxWidth: 780, color: "#607080", fontSize: 34 }}>
              Turn Strava activities into CSV files prepared for ChatGPT, Claude, and Gemini.
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 26, color: "#17202a" }}>
            <span>OAuth</span>
            <span style={{ color: "#fc4c02" }}>{"->"}</span>
            <span>Background sync</span>
            <span style={{ color: "#fc4c02" }}>{"->"}</span>
            <span>CSV ZIP</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
