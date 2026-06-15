"use client";

import { Bell, Search } from "lucide-react";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";
import { alerts } from "@/lib/mock-data";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { collapsed } = useSidebar();
  const criticalCount = alerts.filter(a => a.type === "danger").length;

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 h-14 flex items-center",
        "bg-bg-surface/80 backdrop-blur-sm border-b border-border",
        "transition-all duration-300 ease-in-out",
        collapsed ? "left-16" : "left-60"
      )}
    >
      <div className="flex items-center justify-between w-full px-5">
        {/* Page title */}
        <div>
          <h1 className="text-sm font-semibold text-text-primary leading-none">{title}</h1>
          {subtitle && <p className="text-2xs text-text-muted mt-0.5">{subtitle}</p>}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-elevated border border-border text-text-muted text-xs w-44">
            <Search size={12} />
            <span>Buscar...</span>
            <span className="ml-auto text-2xs text-text-muted/50">⌘K</span>
          </div>

          {/* Notifications */}
          <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
            <Bell size={15} />
            {criticalCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger-DEFAULT" />
            )}
          </button>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5 text-2xs text-text-muted">
            <span className="status-dot bg-success-DEFAULT animate-pulse-slow" />
            <span className="hidden sm:inline">Live</span>
          </div>
        </div>
      </div>
    </header>
  );
}
