import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Keep HTML documents out of shared/CDN caches.
        //
        // Prerendered pages (/login, /announcements) are served by Next with
        // `s-maxage=31536000`, which is only safe on a host that purges its
        // edge cache on deploy. Hostinger's CDN does not, so after a redeploy
        // it can keep serving the previous build's HTML -- which still points
        // at /_next/static/css/<old-hash>.css. That file is gone from the new
        // build, so the stylesheet 404s and the page renders with no CSS at
        // all, while unchanged JS chunks (same content hash) still load.
        //
        // Hashed assets under /_next/static are content-addressed and keep
        // their own long-lived immutable caching.
        source: "/((?!_next/static|_next/image).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
