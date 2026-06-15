"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface SidebarCtx {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
}

export const SidebarContext = createContext<SidebarCtx>({
  collapsed: false,
  toggle: () => {},
  setCollapsed: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = useCallback(() => setCollapsed(p => !p), []);
  return { collapsed, toggle, setCollapsed };
}
