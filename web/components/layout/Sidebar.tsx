"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, TrendingUp, BarChart3, Users, Boxes,
  Truck, MapPin, Brain, Sparkles, ChevronLeft, ChevronRight,
  Leaf,
} from "lucide-react";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Inicio",       href: "/",          icon: LayoutDashboard, badge: null },
  { label: "Comercial",    href: "/comercial",  icon: TrendingUp,      badge: null },
  { label: "Finanzas",     href: "/finanzas",   icon: BarChart3,       badge: null },
  { label: "Clientes",     href: "/clientes",   icon: Users,           badge: "47" },
  { label: "Inventario",   href: "/inventario", icon: Boxes,           badge: "3" },
  { label: "Logística",    href: "/logistica",  icon: Truck,           badge: null },
  { label: "GIS",          href: "/gis",        icon: MapPin,          badge: null },
  { label: "ML · IA",     href: "/ml",         icon: Brain,           badge: null },
  { label: "AI Copilot",  href: "/copilot",    icon: Sparkles,        badge: null },
] as const;

export function Sidebar() {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 h-screen z-40 flex flex-col",
        "bg-bg-surface border-r border-border",
        "transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-14 px-4 border-b border-border flex-shrink-0",
        collapsed ? "justify-center" : "gap-3"
      )}>
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-DEFAULT flex items-center justify-center glow-blue">
          <Leaf size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary leading-none">AgroNova</p>
            <p className="text-2xs text-text-muted">Decision Intelligence</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map(({ label, href, icon: Icon, badge }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                "transition-all duration-150 relative group",
                active
                  ? "bg-primary-dim text-primary-light border border-primary-DEFAULT/25"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-primary-DEFAULT rounded-r" />
              )}
              <Icon
                size={17}
                className={cn(
                  "flex-shrink-0",
                  active ? "text-primary-light" : "text-text-muted group-hover:text-text-secondary"
                )}
              />
              {!collapsed && (
                <>
                  <span className="truncate">{label}</span>
                  {badge && (
                    <span className="ml-auto text-2xs font-semibold px-1.5 py-0.5 rounded bg-danger-bg text-danger-DEFAULT border border-danger-dim/50">
                      {badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && badge && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger-DEFAULT" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-border p-2">
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-primary-DEFAULT flex items-center justify-center text-xs font-bold text-white">
              G
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">Germán Cárdenas</p>
              <p className="text-2xs text-text-muted truncate">Director</p>
            </div>
          </div>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-text-muted",
            "hover:bg-bg-elevated hover:text-text-secondary transition-colors"
          )}
        >
          {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Colapsar</span></>}
        </button>
      </div>
    </aside>
  );
}
