import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabasePattern = (() => {
  if (!supabaseUrl) return null;

  try {
    const url = new URL(supabaseUrl);
    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: "",
      pathname: "/storage/v1/object/public/**",
      search: "",
    };
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
    proxyClientMaxBodySize: "30mb",
  },
  images: {
    // AVIF first, WebP for browsers without it. Every <Image> asks for
    // IMAGE_QUALITY (85); 75 stays allowed so URLs rendered before this change
    // still resolve instead of 400ing in an already-open tab.
    formats: ["image/avif", "image/webp"],
    qualities: [75, 85],
    remotePatterns: supabasePattern ? [supabasePattern] : [],
    minimumCacheTTL: 31_536_000, // 365 days
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
