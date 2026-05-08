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
	images: {
		qualities: [75],
		remotePatterns: supabasePattern ? [supabasePattern] : [],
	},
	turbopack: {
		root: projectRoot,
	},
};

export default nextConfig;
