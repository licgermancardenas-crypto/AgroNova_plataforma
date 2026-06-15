import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Transpile react-leaflet for App Router
  transpilePackages: ["react-leaflet"],
};

export default config;
