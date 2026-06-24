import { ImageResponse } from "next/og";

// Apple touch icon. 180x180 is the canonical size Safari requests; rendered
// from the same "A]" monogram as app/icon.svg so the home-screen icon matches
// the wordmark. No custom fonts needed (pure SVG paths), so the edge runtime
// is fine here.
export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#11223a"
        }}
      >
        <svg width="132" height="132" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M52 186L96 64H126L170 186H141L132 161H89L80 186H52ZM97 136H124L111 95L97 136Z" fill="#f9fbff" />
          <path
            d="M162 79H204C214.493 79 223 87.5066 223 98V158C223 168.493 214.493 177 204 177H162V79ZM190 104H183V152H190C194.418 152 198 148.418 198 144V112C198 107.582 194.418 104 190 104Z"
            fill="#ff7a3d"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
