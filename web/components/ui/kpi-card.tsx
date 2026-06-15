import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface KPICardProps {
  label: string;
  value: string;
  subvalue?: string;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  accent?: "blue" | "cyan" | "green" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const accentStyles = {
  blue:    { bar: "bg-primary-DEFAULT", icon: "bg-primary-dim text-primary-light", glow: "hover:shadow-[0_0_20px_rgba(30,111,219,0.2)]" },
  cyan:    { bar: "bg-cyan-brand",      icon: "bg-cyan-glow text-cyan-brand",      glow: "hover:shadow-[0_0_20px_rgba(6,200,255,0.15)]" },
  green:   { bar: "bg-success-DEFAULT", icon: "bg-success-bg text-success-DEFAULT",glow: "hover:shadow-[0_0_20px_rgba(13,184,126,0.15)]" },
  warning: { bar: "bg-warning-DEFAULT", icon: "bg-warning-bg text-warning-DEFAULT",glow: "hover:shadow-[0_0_20px_rgba(232,160,32,0.15)]" },
  danger:  { bar: "bg-danger-DEFAULT",  icon: "bg-danger-bg text-danger-DEFAULT",  glow: "hover:shadow-[0_0_20px_rgba(224,62,62,0.15)]" },
};

export function KPICard({
  label,
  value,
  subvalue,
  change,
  changeLabel,
  icon,
  accent = "blue",
  size = "md",
  className,
}: KPICardProps) {
  const a = accentStyles[accent];
  const isPositive = change !== undefined && change >= 0;

  return (
    <div
      className={cn(
        "glass glass-hover rounded-xl overflow-hidden transition-all duration-200",
        a.glow,
        size === "sm" && "p-3",
        size === "md" && "p-4",
        size === "lg" && "p-5",
        className
      )}
    >
      {/* Top accent bar */}
      <div className={cn("h-0.5 -mx-4 -mt-4 mb-4", a.bar)} />

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-2xs font-medium text-text-muted uppercase tracking-widest truncate">{label}</p>
          <p className={cn(
            "font-bold text-text-primary mt-1 leading-none tabular-nums",
            size === "sm" && "text-xl",
            size === "md" && "text-2xl",
            size === "lg" && "text-3xl",
          )}>
            {value}
          </p>
          {subvalue && (
            <p className="text-xs text-text-secondary mt-1">{subvalue}</p>
          )}
          {change !== undefined && (
            <div className={cn(
              "inline-flex items-center gap-1 mt-2 text-xs font-medium",
              isPositive ? "text-success-DEFAULT" : "text-danger-DEFAULT"
            )}>
              <span>{isPositive ? "▲" : "▼"}</span>
              <span>{Math.abs(change).toFixed(1)}%{changeLabel ? ` ${changeLabel}` : ""}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={cn("flex-shrink-0 ml-3 w-10 h-10 rounded-lg flex items-center justify-center text-lg", a.icon)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatBadgeProps {
  label: string;
  value: string | number;
  type?: "success" | "warning" | "danger" | "info" | "neutral";
  className?: string;
}

export function StatBadge({ label, value, type = "neutral", className }: StatBadgeProps) {
  const styles = {
    success: "bg-success-bg text-success-DEFAULT border-success-dim",
    warning: "bg-warning-bg text-warning-DEFAULT border-warning-dim",
    danger:  "bg-danger-bg text-danger-DEFAULT border-danger-dim",
    info:    "bg-primary-dim text-primary-light border-primary-DEFAULT/30",
    neutral: "bg-bg-elevated text-text-secondary border-border",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", styles[type], className)}>
      {label}: <strong>{value}</strong>
    </span>
  );
}

interface AlertBadgeProps {
  type: "danger" | "warning" | "info";
  children: ReactNode;
  className?: string;
}

export function AlertBadge({ type, children, className }: AlertBadgeProps) {
  const map = {
    danger:  "bg-danger-bg border border-danger-dim/50 text-danger-DEFAULT",
    warning: "bg-warning-bg border border-warning-dim/50 text-warning-DEFAULT",
    info:    "bg-primary-dim border border-primary-DEFAULT/30 text-primary-light",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium", map[type], className)}>
      {children}
    </span>
  );
}
