import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  hover?: boolean;
  glow?: "blue" | "cyan" | "green" | "none";
  padding?: "sm" | "md" | "lg" | "none";
}

export function GlassCard({
  children,
  className,
  elevated = false,
  hover = false,
  glow = "none",
  padding = "md",
}: GlassCardProps) {
  const padMap = { sm: "p-3", md: "p-4", lg: "p-6", none: "" };
  const glowMap = {
    blue:  "shadow-[0_0_20px_rgba(30,111,219,0.2)]",
    cyan:  "shadow-[0_0_20px_rgba(6,200,255,0.15)]",
    green: "shadow-[0_0_20px_rgba(13,184,126,0.15)]",
    none:  "",
  };
  return (
    <div
      className={cn(
        "rounded-xl",
        elevated ? "glass-elevated" : "glass",
        hover && "glass-hover cursor-pointer",
        padMap[padding],
        glowMap[glow],
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, subtitle, action, icon }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon && (
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-dim flex items-center justify-center text-primary-light">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {subtitle && <p className="text-2xs text-text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("border-t border-border-subtle my-4", className)} />;
}
