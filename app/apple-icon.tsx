import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 36,
          background:
            "radial-gradient(circle at top left, rgba(16,185,129,0.3), transparent 38%), linear-gradient(180deg, #08131d 0%, #061018 100%)",
          color: "white",
          fontSize: 72,
          fontWeight: 700,
        }}
      >
        TT
      </div>
    ),
    size,
  );
}
