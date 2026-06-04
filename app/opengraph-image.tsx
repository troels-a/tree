import { ImageResponse } from "next/og";
import { LOGO_DATA_URI } from "./logo-data";

export const alt = "tree — build ASCII directory structures quickly";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          padding: "72px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_DATA_URI}
          width={214}
          height={240}
          alt=""
          style={{ marginBottom: "28px" }}
        />
        <div
          style={{
            fontSize: "92px",
            fontWeight: 700,
            color: "#111111",
            letterSpacing: "0.04em",
            lineHeight: 1,
          }}
        >
          tree
        </div>
        <div
          style={{
            fontSize: "32px",
            color: "#888888",
            marginTop: "20px",
            textAlign: "center",
          }}
        >
          Build ASCII directory structures quickly.
        </div>
      </div>
    ),
    { ...size }
  );
}
