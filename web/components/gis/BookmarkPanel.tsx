"use client";

import { useState, useEffect } from "react";
import { Bookmark, BookmarkPlus, Trash2, FolderOpen } from "lucide-react";
import type { CameraTarget, MapEngine } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookmarkEntry {
  id:        string;
  name:      string;
  camera:    CameraTarget;
  engine:    MapEngine;
  createdAt: number;
}

const STORAGE_KEY = "agronova_gis_bookmarks_v1";

const DEFAULT_BOOKMARKS: BookmarkEntry[] = [
  {
    id: "def_nacional", name: "Operación Nacional", engine: "mapbox", createdAt: 0,
    camera: { center: [-64, -38], zoom: 3.8, pitch: 45, bearing: -8, duration: 3000 },
  },
  {
    id: "def_pam", name: "Pampeana", engine: "mapbox", createdAt: 0,
    camera: { center: [-62, -34], zoom: 5.5, pitch: 35, bearing: 0, duration: 2500 },
  },
  {
    id: "def_pat", name: "Patagonia", engine: "earth", createdAt: 0,
    camera: { center: [-68, -47], zoom: 4.5, pitch: 40, bearing: -10, duration: 3000 },
  },
  {
    id: "def_rosario", name: "Rosario Hub", engine: "earth", createdAt: 0,
    camera: { center: [-60.65, -32.95], zoom: 10, pitch: 60, bearing: 20, duration: 4000 },
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  currentCamera: CameraTarget;
  currentEngine: MapEngine;
  onLoad:        (entry: BookmarkEntry) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookmarkPanel({ currentCamera, currentEngine, onLoad }: Props) {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [adding,    setAdding]    = useState(false);
  const [newName,   setNewName]   = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed: BookmarkEntry[] = stored ? JSON.parse(stored) : [];
      setBookmarks([...DEFAULT_BOOKMARKS, ...parsed]);
    } catch {
      setBookmarks(DEFAULT_BOOKMARKS);
    }
  }, []);

  function saveCustom(entries: BookmarkEntry[]) {
    const custom = entries.filter(e => !e.id.startsWith("def_"));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(custom)); } catch { /* quota */ }
  }

  function addBookmark() {
    if (!newName.trim()) return;
    const entry: BookmarkEntry = {
      id:        `bm_${Date.now()}`,
      name:      newName.trim(),
      camera:    { ...currentCamera },
      engine:    currentEngine,
      createdAt: Date.now(),
    };
    const next = [...bookmarks, entry];
    setBookmarks(next);
    saveCustom(next);
    setNewName(""); setAdding(false);
  }

  function deleteBookmark(id: string) {
    const next = bookmarks.filter(b => b.id !== id);
    setBookmarks(next);
    saveCustom(next);
  }

  const ENGINE_COLOR: Record<MapEngine, string> = {
    leaflet: "#22C55E",
    mapbox:  "#A3E635",
    earth:   "#38BDF8",
  };

  return (
    <div className="flex flex-col gap-1.5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Bookmark size={9} className="text-primary" />
          <span className="tactical-text font-bold" style={{ color: "#22C55E" }}>BOOKMARKS</span>
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-all"
          style={{ background: adding ? "rgba(34,197,94,0.12)" : "transparent", border: "1px solid rgba(34,197,94,0.20)", color: "#22C55E" }}
        >
          <BookmarkPlus size={8} />
          <span className="tactical-text" style={{ fontSize: 7.5 }}>GUARDAR</span>
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="flex gap-1">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addBookmark(); if (e.key === "Escape") setAdding(false); }}
            placeholder="Nombre de la vista..."
            className="flex-1 font-mono rounded px-2 py-1 outline-none"
            style={{ background: "rgba(7,18,9,0.7)", border: "1px solid rgba(34,197,94,0.25)", color: "#DCE8DC", fontSize: 9 }}
          />
          <button
            onClick={addBookmark}
            className="px-2 py-1 rounded font-mono text-2xs transition-all"
            style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#22C55E" }}
          >
            OK
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {bookmarks.map(b => (
          <div
            key={b.id}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded transition-all group"
            style={{ background: "rgba(7,18,9,0.5)", border: "1px solid rgba(34,197,94,0.10)" }}
          >
            <button
              onClick={() => onLoad(b)}
              className="flex-1 text-left flex items-center gap-1.5 min-w-0"
            >
              <FolderOpen size={8} style={{ color: ENGINE_COLOR[b.engine], flexShrink: 0 }} />
              <span className="font-mono text-2xs truncate" style={{ color: "#7A9C7A" }}>{b.name}</span>
              <span className="tactical-text flex-shrink-0" style={{ color: ENGINE_COLOR[b.engine], fontSize: 7 }}>
                {b.engine.toUpperCase()}
              </span>
            </button>
            {!b.id.startsWith("def_") && (
              <button
                onClick={() => deleteBookmark(b.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              >
                <Trash2 size={8} style={{ color: "#E03E3E" }} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export type { BookmarkEntry };
