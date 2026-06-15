// Number and date formatters for AgroNova platform

export const fmtARS = (n: number, compact = false): string => {
  if (compact) {
    if (n >= 1_000_000_000) return `ARS ${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000)     return `ARS ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)         return `ARS ${(n / 1_000).toFixed(0)}K`;
    return `ARS ${n.toFixed(0)}`;
  }
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
};

export const fmtUSD = (n: number, compact = false): string => {
  if (compact) {
    if (n >= 1_000_000) return `USD ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `USD ${(n / 1_000).toFixed(0)}K`;
    return `USD ${n.toFixed(0)}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
};

export const fmtPct = (n: number, decimals = 1): string =>
  `${n > 0 ? "+" : ""}${n.toFixed(decimals)}%`;

export const fmtPctAbs = (n: number, decimals = 1): string =>
  `${n.toFixed(decimals)}%`;

export const fmtNumber = (n: number): string =>
  new Intl.NumberFormat("es-AR").format(Math.round(n));

export const fmtDate = (d: string): string => {
  const [year, month] = d.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
};

export const riskColor = (risk: string): string => {
  if (risk === "High")   return "text-danger-DEFAULT";
  if (risk === "Medium") return "text-warning-DEFAULT";
  return "text-success-DEFAULT";
};

export const riskBg = (risk: string): string => {
  if (risk === "High")   return "bg-danger-bg text-danger-DEFAULT border border-danger-dim";
  if (risk === "Medium") return "bg-warning-bg text-warning-DEFAULT border border-warning-dim";
  return "bg-success-bg text-success-DEFAULT border border-success-dim";
};

export const priorityColor = (p: string): string => {
  if (p === "1_Sin_Stock")  return "text-danger-DEFAULT";
  if (p === "2_Critico_A")  return "text-danger-DEFAULT";
  if (p === "3_Critico_B")  return "text-warning-DEFAULT";
  if (p === "4_Bajo_Minimo") return "text-warning-DEFAULT";
  if (p === "5_Alerta")     return "text-cyan-brand";
  return "text-success-DEFAULT";
};

export const tierColor = (tier: string): string => {
  if (tier === "A") return "bg-primary-dim text-primary-light border border-primary-DEFAULT/30";
  if (tier === "B") return "bg-cyan-glow text-cyan-brand border border-cyan-brand/30";
  if (tier === "C") return "bg-bg-elevated text-text-secondary border border-border";
  return "bg-bg-elevated text-text-muted border border-border-subtle";
};
