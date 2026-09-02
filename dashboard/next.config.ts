import type { NextConfig } from "next";

// Browsers replay a stored HTML shell without revalidating (restart, history nav), and a
// shell from a previous deployment requests /_next/static chunks that now 404, so React
// never hydrates until a manual reload. These routes are auth-gated and must not be stored.
const noStore = [{ key: "Cache-Control", value: "no-store, must-revalidate" }];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/", headers: noStore },
      { source: "/login", headers: noStore },
    ];
  },
};

export default nextConfig;
