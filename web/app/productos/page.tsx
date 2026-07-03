"use client";

import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, CardHeader } from "@/components/ui/glass-card";
import { KPICard } from "@/components/ui/kpi-card";
import { DonutChart } from "@/components/charts/DonutChart";
import { SimpleTable } from "@/components/ui/simple-table";
import { TOOLTIP_STYLE, AXIS_TICK, AXIS_TICK_LABEL } from "@/lib/chart-theme";
import { fmtARS, fmtUSD, fmtPctAbs, fmtNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Package, Snowflake, CheckCircle2, Tag, Search } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface ProductoCatalogo {
  producto_id: string;
  nombre_producto: string;
  categoria: string;
  subcategoria: string;
  unidad_medida: string;
  precio_usd_base_2016: number;
  margen_bruto_pct: number;
  rotacion: string;
  requiere_frio: boolean;
  estacionalidad_alta: string;
  activo: boolean;
  nombre_proveedor: string;
  revenue_ars: number;
  revenue_usd: number;
  unidades_vendidas: number;
  n_ventas: number;
  stock_actual: number;
  stock_minimo: number;
  valor_stock_ars: number;
  bajo_minimo: number;
  margen_pct_real: number;
}

interface CategoriaSummary {
  categoria: string;
  n_productos: number;
  revenue_ars: number;
  margen_promedio: number;
  activos: number;
}

const CAT_COLOR: Record<string, string> = {
  "Fertilizantes":        "#0DB87E",
  "Fitosanitarios":       "#E03E3E",
  "Semillas":             "#A3E635",
  "Tecnología Agrícola":  "#06C8FF",
  "Nutrición Vegetal":    "#E8A020",
};
const FALLBACK_COLORS = ["#0DB87E", "#06C8FF", "#A3E635", "#E8A020", "#E03E3E", "#1E6FDB"];
const colorFor = (cat: string, i: number) => CAT_COLOR[cat] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];

const rotacionColor = (r: string) =>
  r === "Alta" ? "text-success-DEFAULT" : r === "Media" ? "text-warning-DEFAULT" : "text-text-muted";

export default function ProductosPage() {
  const [productos, setProductos]   = useState<ProductoCatalogo[]>([]);
  const [categorias, setCategorias] = useState<CategoriaSummary[]>([]);
  const [loading, setLoading]       = useState(true);

  const [search, setSearch]     = useState("");
  const [catFilter, setCatFilter] = useState<string>("Todas");
  const [soloActivos, setSoloActivos] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/data/products/products.json").then(r => r.json()),
      fetch("/data/products/categories.json").then(r => r.json()),
    ])
      .then(([prods, cats]) => {
        setProductos(prods);
        setCategorias(cats);
      })
      .finally(() => setLoading(false));
  }, []);

  const kpis = useMemo(() => {
    if (!productos.length) return null;
    const activos = productos.filter(p => p.activo).length;
    const frio    = productos.filter(p => p.requiere_frio).length;
    const precioProm = productos.reduce((s, p) => s + p.precio_usd_base_2016, 0) / productos.length;
    const margenProm = productos.reduce((s, p) => s + p.margen_bruto_pct, 0) / productos.length;
    return { total: productos.length, activos, frio, precioProm, margenProm };
  }, [productos]);

  const topRevenue = useMemo(
    () => [...productos].sort((a, b) => b.revenue_ars - a.revenue_ars).slice(0, 10),
    [productos]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productos
      .filter(p => (catFilter === "Todas" || p.categoria === catFilter))
      .filter(p => (!soloActivos || p.activo))
      .filter(p => !q || p.nombre_producto.toLowerCase().includes(q) || p.subcategoria.toLowerCase().includes(q))
      .sort((a, b) => b.revenue_ars - a.revenue_ars);
  }, [productos, search, catFilter, soloActivos]);

  const shown = filtered.slice(0, 50);
  const categoriaOptions = ["Todas", ...categorias.map(c => c.categoria)];

  if (loading) {
    return (
      <AppLayout title="Catálogo de Productos" subtitle="2.500 SKUs · Categorías · Márgenes · Ventas">
        <div className="flex items-center justify-center h-64 text-text-muted text-sm">Cargando catálogo…</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Catálogo de Productos" subtitle="Dim_Producto · Ventas y stock reales · 2026">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KPICard label="Total SKUs" value={fmtNumber(kpis?.total ?? 0)} subvalue={`${categorias.length} categorías`} accent="blue" icon={<Package size={18} />} />
        <KPICard label="Productos Activos" value={fmtNumber(kpis?.activos ?? 0)} subvalue={`${fmtPctAbs(((kpis?.activos ?? 0) / (kpis?.total || 1)) * 100)} del catálogo`} accent="green" icon={<CheckCircle2 size={18} />} />
        <KPICard label="Precio Promedio" value={fmtUSD(kpis?.precioProm ?? 0)} subvalue="USD base · lista 2016" accent="cyan" icon={<Tag size={18} />} />
        <KPICard label="Requieren Frío" value={fmtNumber(kpis?.frio ?? 0)} subvalue={`Margen prom. ${fmtPctAbs((kpis?.margenProm ?? 0) * 100)}`} accent="warning" icon={<Snowflake size={18} />} />
      </div>

      {/* Category revenue donut + Top products bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <GlassCard>
          <CardHeader title="Revenue por Categoría" subtitle="Facturación acumulada · ARS" />
          <DonutChart
            data={categorias.map((c, i) => ({ name: c.categoria, value: Math.round(c.revenue_ars), color: colorFor(c.categoria, i) }))}
            centerLabel="Categorías"
            centerValue={String(categorias.length)}
            height={220}
          />
          <div className="mt-3 space-y-2">
            {categorias.map((c, i) => (
              <div key={c.categoria} className="flex items-center gap-3 py-1.5 border-b border-border-subtle last:border-0">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorFor(c.categoria, i) }} />
                <span className="text-xs text-text-secondary flex-1">{c.categoria}</span>
                <span className="text-xs font-mono text-text-primary">{fmtNumber(c.n_productos)} SKUs</span>
                <span className="text-2xs text-text-muted w-16 text-right">{fmtPctAbs(c.margen_promedio * 100)} marg.</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <CardHeader title="Top 10 Productos por Revenue" subtitle="Ranking histórico acumulado" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topRevenue} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
              <XAxis type="number" tickFormatter={v => fmtARS(v, true)} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="nombre_producto"
                width={140}
                tick={AXIS_TICK_LABEL}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => v.length > 20 ? `${v.slice(0, 20)}…` : v}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => fmtARS(v)} />
              <Bar dataKey="revenue_ars" radius={[0, 3, 3, 0]} maxBarSize={16}>
                {topRevenue.map((p, i) => <Cell key={p.producto_id} fill={colorFor(p.categoria, i)} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Catalog table */}
      <GlassCard>
        <CardHeader
          title="Catálogo Completo"
          subtitle={`${fmtNumber(filtered.length)} productos${filtered.length > 50 ? " · mostrando los primeros 50 por revenue" : ""}`}
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar producto…"
                  className="pl-7 pr-2 py-1.5 text-xs bg-bg-elevated border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary-DEFAULT/50 w-40"
                />
              </div>
              <select
                value={catFilter}
                onChange={e => setCatFilter(e.target.value)}
                className="text-xs bg-bg-elevated border border-border rounded-lg px-2 py-1.5 text-text-primary focus:outline-none focus:border-primary-DEFAULT/50"
              >
                {categoriaOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-2xs text-text-secondary cursor-pointer select-none">
                <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} className="accent-primary-DEFAULT" />
                Solo activos
              </label>
            </div>
          }
        />
        <SimpleTable headers={["Producto", "Categoría", "Proveedor", "Precio USD", "Margen", "Rotación", "Stock", "Revenue ARS", "Estado"]}>
          {shown.map(p => (
            <tr key={p.producto_id} className="tr-hover border-b border-border-subtle last:border-0">
              <td className="py-2 px-3 first:pl-0">
                <span className="text-text-primary font-medium">{p.nombre_producto}</span>
                {p.requiere_frio && <Snowflake size={11} className="inline ml-1.5 text-cyan-brand" />}
              </td>
              <td className="py-2 px-3 text-text-secondary">{p.categoria}</td>
              <td className="py-2 px-3 text-text-secondary">{p.nombre_proveedor}</td>
              <td className="py-2 px-3 font-mono text-text-primary">{fmtUSD(p.precio_usd_base_2016)}</td>
              <td className="py-2 px-3 font-mono text-text-primary">{fmtPctAbs(p.margen_bruto_pct * 100)}</td>
              <td className={cn("py-2 px-3 font-mono", rotacionColor(p.rotacion))}>{p.rotacion}</td>
              <td className="py-2 px-3 font-mono text-text-primary">
                {fmtNumber(p.stock_actual)}
                {p.bajo_minimo === 1 && <span className="ml-1.5 text-2xs text-danger-DEFAULT">bajo mín.</span>}
              </td>
              <td className="py-2 px-3 font-mono text-text-primary">{fmtARS(p.revenue_ars, true)}</td>
              <td className="py-2 px-3">
                <span className={cn("px-2 py-0.5 rounded text-2xs",
                  p.activo ? "bg-success-bg text-success-DEFAULT" : "bg-bg-elevated text-text-muted"
                )}>{p.activo ? "Activo" : "Inactivo"}</span>
              </td>
            </tr>
          ))}
        </SimpleTable>
      </GlassCard>
    </AppLayout>
  );
}
