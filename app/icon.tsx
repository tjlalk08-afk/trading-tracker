import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at top left, rgba(16,185,129,0.35), transparent 40%), linear-gradient(180deg, #08131d 0%, #061018 100%)",
          color: "white",
          fontSize: 180,
          fontWeight: 700,
        }}
      >
        TT
      </div>
    ),
    size,
  );
}
