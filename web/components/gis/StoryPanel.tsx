"use client";

import { memo } from "react";
import { ChevronLeft, ChevronRight, Play, Square, X, Zap } from "lucide-react";

export interface StoryScene {
  id: string;
  title: string;
  description: string;
  insight: string;
}

interface Props {
  scene: StoryScene;
  sceneIndex: number;
  totalScenes: number;
  isAutoPlay: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleAutoPlay: () => void;
  onExit: () => void;
}

const SCENE_COLORS: Record<string, string> = {
  overview:    "#22C55E",
  customer:    "#F97316",
  territory:   "#A3E635",
  logistics:   "#0EA5E9",
  environment: "#0DB87E",
  expansion:   "#E8A020",
};

const StoryPanel = memo(function StoryPanel({
  scene, sceneIndex, totalScenes, isAutoPlay,
  onPrev, onNext, onToggleAutoPlay, onExit,
}: Props) {
  const accent = SCENE_COLORS[scene.id] ?? "#22C55E";
  const progress = ((sceneIndex + 1) / totalScenes) * 100;

  return (
    <div
      className="w-[340px] rounded-2xl overflow-hidden"
      style={{
        background:     "rgba(5, 12, 6, 0.94)",
        backdropFilter: "blur(20px) saturate(160%)",
        border:         `1px solid ${accent}30`,
        boxShadow:      `0 8px 40px rgba(0,0,0,0.7), 0 0 32px ${accent}12`,
      }}
    >
      {/* Progress bar */}
      <div className="h-0.5 w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div
          className="h-full"
          style={{ width: `${progress}%`, background: accent, transition: "width 0.5s ease" }}
        />
      </div>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: `${accent}20` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0 blink"
            style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
          />
          <span className="font-mono font-bold tracking-widest" style={{ fontSize: 9, color: accent, letterSpacing: "0.15em" }}>
            STORY MODE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono" style={{ fontSize: 10, color: "#4B6B4B" }}>
            {sceneIndex + 1} <span style={{ color: "#2A4A2A" }}>/</span> {totalScenes}
          </span>
          <button
            onClick={onExit}
            className="w-5 h-5 rounded flex items-center justify-center transition-colors"
            style={{ color: "#4B6B4B" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#E03E3E")}
            onMouseLeave={e => (e.currentTarget.style.color = "#4B6B4B")}
            title="Salir del Story Mode"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Scene content */}
      <div className="px-4 pt-3 pb-2">
        {/* Title */}
        <h2
          className="font-mono font-bold mb-1 leading-tight"
          style={{ fontSize: 16, color: accent }}
        >
          {scene.title}
        </h2>

        {/* Description */}
        <p className="text-2xs leading-relaxed mb-3" style={{ color: "#7A9C7A" }}>
          {scene.description}
        </p>

        {/* Insight box */}
        <div
          className="rounded-lg px-3 py-2 mb-3 flex gap-2"
          style={{
            background:   `${accent}08`,
            borderLeft:   `2px solid ${accent}60`,
            border:       `1px solid ${accent}18`,
            borderLeftWidth: 3,
            borderLeftColor: accent,
          }}
        >
          <Zap size={10} className="flex-shrink-0 mt-0.5" style={{ color: accent }} />
          <p className="text-2xs leading-relaxed" style={{ color: "#DCE8DC" }}>
            {scene.insight}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div
        className="flex items-center gap-1.5 px-3 pb-3"
        style={{ borderTop: `1px solid rgba(255,255,255,0.04)`, paddingTop: 10 }}
      >
        {/* Prev */}
        <button
          onClick={onPrev}
          disabled={sceneIndex === 0 && !isAutoPlay}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-mono transition-all border"
          style={{
            fontSize: 9,
            background:  "rgba(7,18,9,0.7)",
            borderColor: "rgba(34,197,94,0.18)",
            color:       sceneIndex === 0 ? "#2A4A2A" : "#7A9C7A",
          }}
        >
          <ChevronLeft size={10} />
          <span>PREV</span>
        </button>

        {/* Auto play toggle */}
        <button
          onClick={onToggleAutoPlay}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono transition-all border flex-1 justify-center"
          style={{
            fontSize: 9,
            background:  isAutoPlay ? `${accent}18` : "rgba(7,18,9,0.7)",
            borderColor: isAutoPlay ? `${accent}50` : "rgba(34,197,94,0.18)",
            color:       isAutoPlay ? accent : "#4B6B4B",
          }}
        >
          {isAutoPlay ? (
            <><Square size={9} /><span>STOP</span></>
          ) : (
            <><Play size={9} /><span>AUTO</span></>
          )}
        </button>

        {/* Next */}
        <button
          onClick={onNext}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-mono transition-all border"
          style={{
            fontSize:    9,
            background:  `${accent}15`,
            borderColor: `${accent}45`,
            color:       accent,
            boxShadow:   `0 0 10px ${accent}10`,
          }}
        >
          <span>NEXT</span>
          <ChevronRight size={10} />
        </button>
      </div>
    </div>
  );
});

export default StoryPanel;
