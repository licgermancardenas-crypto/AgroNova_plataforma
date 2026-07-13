import type { NextConfig } from "next";

const config: NextConfig = {
  // Off because React 18 StrictMode's double effect-invoke makes react-leaflet
  // v4's MapContainer throw "Map container is already initialized" on every
  // /gis load in dev. Open upstream bug, only fixed in react-leaflet v5 (needs
  // React 19). Dev-only setting — doesn't affect production behavior.
  reactStrictMode: false,
  // Transpile react-leaflet for App Router
  transpilePackages: ["react-leaflet", "mapbox-gl"],
};

export default config;
