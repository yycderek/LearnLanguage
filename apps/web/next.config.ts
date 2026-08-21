import type { NextConfig } from "next";

const freshDocumentHeaders = [
  { key: "Cache-Control", value: "no-store, max-age=0" },
  { key: "CDN-Cache-Control", value: "no-store" },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
];

const nextConfig: NextConfig = {
  async headers() {
    return ["/", "/learn", "/studio"].map((source) => ({ source, headers: freshDocumentHeaders }));
  },
};

export default nextConfig;
