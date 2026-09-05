import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // googleapis is a large, server-only client library — keep it out of the
  // client bundle and let Node resolve it at runtime on the server.
  serverExternalPackages: ["googleapis"],
};

export default nextConfig;