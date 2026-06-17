"use client";

import { useEffect, useState } from "react";
import { useMapEvents, ScaleControl } from "react-leaflet";

interface Props {
  showCoords: boolean;
}

export default function ScaleCoordsControl({ showCoords }: Props) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [zoom, setZoom] = useState(5);

  useMapEvents({
    mousemove(e) {
      setCoords({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
    mouseover(e) {
      setCoords({ lat: e.latlng?.lat ?? 0, lon: e.latlng?.lng ?? 0 });
    },
    zoomend(e) {
      setZoom(e.target.getZoom());
    },
  });

  return (
    <>
      <ScaleControl position="bottomleft" imperial={false} />
      {showCoords && coords && (
        <div
          style={{
            position: "absolute",
            bottom: 36,
            left: 10,
            zIndex: 1000,
            background: "rgba(7,18,9,0.82)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 5,
            padding: "3px 8px",
            fontFamily: "monospace",
            fontSize: 10,
            color: "#7A9C7A",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span style={{ color: "#4ADE80" }}>LAT</span>
          <span style={{ color: "#DCE8DC" }}>{coords.lat.toFixed(4)}°</span>
          <span style={{ color: "#4ADE80" }}>LON</span>
          <span style={{ color: "#DCE8DC" }}>{coords.lon.toFixed(4)}°</span>
          <span style={{ borderLeft: "1px solid #1A3D20", paddingLeft: 8, color: "#4ADE80" }}>Z</span>
          <span style={{ color: "#DCE8DC" }}>{zoom}</span>
        </div>
      )}
    </>
  );
}
