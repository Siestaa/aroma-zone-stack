import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/:section(account|cart|checkout)/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex" }],
    }];
  },
  // Local dev only — proxies same-origin /api/* to the Fastify backend so
  // cookies/fetches behave exactly like production's Nginx same-origin setup
  // (see api/README / deploy notes). In production this rewrite doesn't run;
  // Nginx does the equivalent proxying at the infra layer instead.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [{ source: "/api/:path*", destination: "http://localhost:4000/api/:path*" }];
  },
};

export default nextConfig;
