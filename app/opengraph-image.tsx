import { ImageResponse } from "next/og";

export const alt = "Scriba — Transcrição de sermões em tempo real";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "#F7FAFD",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      {/* Background accent blob */}
      <div
        style={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "rgba(79, 168, 240, 0.08)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -60,
          left: -60,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "rgba(248, 198, 75, 0.08)",
        }}
      />

      {/* Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#EAF4FE",
          color: "#4FA8F0",
          borderRadius: 999,
          padding: "8px 20px",
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 28,
          letterSpacing: "-0.01em",
        }}
      >
        ✦ Powered by IA
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 96,
          fontWeight: 800,
          color: "#2B3947",
          letterSpacing: "-0.04em",
          lineHeight: 1,
          marginBottom: 20,
        }}
      >
        Scriba
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 30,
          color: "#6E7C8B",
          maxWidth: 680,
          textAlign: "center",
          lineHeight: 1.4,
          marginBottom: 52,
        }}
      >
        Transcrição e resumo de sermões em tempo real
      </div>

      {/* URL pill */}
      <div
        style={{
          padding: "14px 40px",
          background: "#4FA8F0",
          color: "white",
          borderRadius: 999,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        scriba.cc
      </div>
    </div>,
    { ...size }
  );
}
