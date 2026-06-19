"use client";

import { useState, useEffect, useRef } from "react";
import { Command, Search, X, ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PaletteCommand {
  id:           string;
  group:        string;
  label:        string;
  description?: string;
  action:       () => void;
}

interface Props {
  commands: PaletteCommand[];
  onClose:  () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommandPalette({ commands, onClose }: Props) {
  const [query,   setQuery]   = useState("");
  const [focused, setFocused] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = !query.trim()
    ? commands
    : commands.filter(c => {
        const q = query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        const label = c.label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        const desc  = (c.description ?? "").toLowerCase();
        const grp   = c.group.toLowerCase();
        return label.includes(q) || desc.includes(q) || grp.includes(q);
      });

  const grouped = filtered.reduce((acc, c) => {
    if (!acc[c.group]) acc[c.group] = [];
    acc[c.group].push(c);
    return acc;
  }, {} as Record<string, PaletteCommand[]>);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setFocused(f => Math.min(f + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
    if (e.key === "Enter" && filtered[focused]) { filtered[focused].action(); onClose(); }
  }

  const GROUP_COLOR: Record<string, string> = {
    "Métrica":   "#22C55E",
    "Motor":     "#38BDF8",
    "Capa":      "#A3E635",
    "Provincia": "#4ADE80",
    "Panel":     "#E8A020",
    "Cámara":    "#C084FC",
    "Tour":      "#F97316",
    "Bookmark":  "#38BDF8",
  };

  return (
    <div
      className="fixed inset-0 z-[900] flex items-start justify-center"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", paddingTop: "18vh" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background:     "rgba(4,10,5,0.98)",
          border:         "1px solid rgba(34,197,94,0.28)",
          boxShadow:      "0 24px 72px rgba(0,0,0,0.85), 0 0 0 1px rgba(34,197,94,0.06), 0 0 40px rgba(34,197,94,0.04)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: "rgba(34,197,94,0.12)" }}>
          <Command size={12} className="text-primary flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setFocused(0); }}
            onKeyDown={handleKey}
            placeholder="Buscar comandos, provincias, capas..."
            className="flex-1 font-mono text-xs outline-none bg-transparent"
            style={{ color: "#DCE8DC" }}
          />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <kbd className="tactical-text px-1.5 py-0.5 rounded font-mono flex-shrink-0"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.20)", color: "#4B6B4B", fontSize: 8 }}>
              ESC
            </kbd>
            <button onClick={onClose}><X size={12} className="text-text-muted hover:text-text-secondary" /></button>
          </div>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {Object.entries(grouped).map(([group, cmds]) => (
            <div key={group}>
              <div className="px-4 py-1" style={{ background: "rgba(34,197,94,0.02)", borderBottom: "1px solid rgba(34,197,94,0.06)" }}>
                <span className="tactical-text" style={{ color: GROUP_COLOR[group] ?? "#3E5A3E", fontSize: 7.5 }}>
                  ▸ {group.toUpperCase()}
                </span>
              </div>
              {cmds.map(cmd => {
                const globalIdx = filtered.indexOf(cmd);
                const isActive  = focused === globalIdx;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => { cmd.action(); onClose(); }}
                    onMouseEnter={() => setFocused(globalIdx)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left transition-all"
                    style={{ background: isActive ? "rgba(34,197,94,0.07)" : "transparent" }}
                  >
                    <span className="font-mono text-xs flex-1 truncate" style={{ color: isActive ? "#22C55E" : "#7A9C7A" }}>
                      {cmd.label}
                    </span>
                    {cmd.description && (
                      <span className="tactical-text flex-shrink-0" style={{ color: "#3E5A3E", fontSize: 8 }}>
                        {cmd.description}
                      </span>
                    )}
                    {isActive && <ChevronRight size={10} style={{ color: "#22C55E", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center">
              <Search size={16} className="mx-auto mb-2 text-text-muted opacity-30" />
              <span className="tactical-text text-xs" style={{ color: "#2A4A2A" }}>Sin resultados para &ldquo;{query}&rdquo;</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t" style={{ borderColor: "rgba(34,197,94,0.08)" }}>
          {[["↑↓", "navegar"], ["↵", "ejecutar"], ["ESC", "cerrar"]].map(([k, v]) => (
            <div key={k} className="flex items-center gap-1">
              <kbd className="tactical-text px-1 rounded font-mono" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", color: "#3E5A3E", fontSize: 7.5 }}>{k}</kbd>
              <span className="tactical-text" style={{ color: "#2A4A2A", fontSize: 7.5 }}>{v}</span>
            </div>
          ))}
          <span className="ml-auto tactical-text" style={{ color: "#2A4A2A", fontSize: 7.5 }}>{filtered.length} comandos</span>
        </div>
      </div>
    </div>
  );
}
