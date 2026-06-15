"use client";

import { SidebarContext, useSidebarState } from "@/hooks/use-sidebar";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const sidebarState = useSidebarState();
  const { collapsed } = sidebarState;

  return (
    <SidebarContext.Provider value={sidebarState}>
      <Sidebar />
      <Header title={title} subtitle={subtitle} />
      <main
        className={cn(
          "min-h-screen pt-14 transition-all duration-300 ease-in-out",
          collapsed ? "pl-16" : "pl-60"
        )}
      >
        <div className="p-5 animate-fade-in">
          {children}
        </div>
      </main>
    </SidebarContext.Provider>
  );
}
