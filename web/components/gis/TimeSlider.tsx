"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, ChevronsLeft, ChevronsRight } from "lucide-react";
import { YEAR_MIN, YEAR_MAX } from "@/lib/timeseries";

interface Props {
  year:      number;
  setYear:   (y: number) => void;
  playing:   boolean;
  setPlaying: (v: boolean) => void;
}

const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);

function yearColor(year: number): string {
  const t = (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN);
  const r = Math.round(14  + t * (34  - 14));
  const g = Math.round(60  + t * (197 - 60));
  const b = Math.round(12  + t * (94  - 12));
  return `rgb(${r},${g},${b})`;
}

export default function TimeSlider({ year, setYear, playing, setPlaying }: Props) {
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const yearRef      = useRef(year);
  yearRef.current    = year;
  const [pulsing, setPulsing] = useState(false);
  const prevYearRef  = useRef(year);

  useEffect(() => {
    if (prevYearRef.current !== year) {
      prevYearRef.current = year;
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 600);
      return () => clearTimeout(t);
    }
  }, [year]);

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setPlaying(false);
  }, [setPlaying]);

  const play = useCallback(() => {
    setPlaying(true);
    intervalRef.current = setInterval(() => {
      if (yearRef.current >= YEAR_MAX) {
        stop();
        return;
      }
      setYear(yearRef.current + 1);
    }, 900);
  }, [setPlaying, setYear, stop]);

  useEffect(() => {
    if (playing && !intervalRef.current) play();
    if (!playing && intervalRef.current)  stop();
  }, [playing, play, stop]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const pct = ((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
  const col = yearColor(year);

  return (
    <div
      className="flex items-center gap-2 glass rounded-xl px-3 py-1.5 flex-1"
      style={{ boxShadow: "0 0 16px rgba(34,197,94,0.04)", minWidth: 0 }}
    >
      {/* Year badge */}
      <div
        className={`flex-shrink-0 font-mono font-bold tabular-nums${pulsing ? " year-change-pulse" : ""}`}
        style={{ fontSize: 15, color: col, minWidth: 40, textShadow: `0 0 8px ${col}60` }}
      >
        {year}
      </div>

      {/* Prev / Slider / Next */}
      <button
        onClick={() => { stop(); setYear(Math.max(YEAR_MIN, year - 1)); }}
        className="flex-shrink-0 p-0.5 rounded opacity-50 hover:opacity-100 transition-opacity"
        style={{ color: col }}
        aria-label="Año anterior"
      >
        <ChevronsLeft size={13} />
      </button>

      <div className="relative flex-1 h-5 flex items-center" style={{ minWidth: 80 }}>
        {/* Track background */}
        <div className="absolute inset-x-0 h-1 rounded-full" style={{ background: "#1A3D20" }} />
        {/* Fill */}
        <div
          className="absolute left-0 h-1 rounded-full"
          style={{ width: `${pct}%`, background: col, opacity: 0.85, transition: "width 0.3s ease" }}
        />
        {/* Year ticks */}
        {YEARS.filter(y => y % 2 === 0).map(y => (
          <div
            key={y}
            className="absolute w-px h-1.5 rounded-full"
            style={{
              left: `${((y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100}%`,
              background: y <= year ? col : "#2A5A2A",
              opacity: 0.5,
              top: "calc(50% - 3px)",
            }}
          />
        ))}
        <input
          type="range"
          min={YEAR_MIN}
          max={YEAR_MAX}
          step={1}
          value={year}
          onChange={e => { stop(); setYear(Number(e.target.value)); }}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ height: "100%" }}
          aria-label="Año seleccionado"
        />
        {/* Thumb indicator */}
        <div
          className="absolute w-3 h-3 rounded-full border-2 -translate-x-1/2"
          style={{
            left: `${pct}%`,
            background: "#071209",
            borderColor: col,
            boxShadow: `0 0 6px ${col}80`,
            transition: "left 0.3s ease",
            pointerEvents: "none",
          }}
        />
      </div>

      <button
        onClick={() => { stop(); setYear(Math.min(YEAR_MAX, year + 1)); }}
        className="flex-shrink-0 p-0.5 rounded opacity-50 hover:opacity-100 transition-opacity"
        style={{ color: col }}
        aria-label="Año siguiente"
      >
        <ChevronsRight size={13} />
      </button>

      {/* Play/Pause */}
      <button
        onClick={() => playing ? stop() : play()}
        className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all"
        style={{
          background: playing ? `${col}25` : `${col}15`,
          border:     `1px solid ${col}40`,
          color:      col,
        }}
        aria-label={playing ? "Pausar" : "Reproducir"}
      >
        {playing ? <Pause size={11} /> : <Play size={11} />}
      </button>

      {/* Range label */}
      <span className="tactical-text flex-shrink-0" style={{ fontSize: 8, color: "#3E5A3E" }}>
        {YEAR_MIN}–{YEAR_MAX}
      </span>
    </div>
  );
}
