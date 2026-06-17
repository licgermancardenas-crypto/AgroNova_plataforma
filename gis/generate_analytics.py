"""
AgroNova v2.0 — Analytics Data Generator
Generates data/gis_outputs/*.json from real CSV data.

Usage:
    python -m gis.generate_analytics
"""
from __future__ import annotations

import json
from pathlib import Path

from . import geo_utils as gu
from .spatial_scores import (
    coverage_score_by_province,
    revenue_density_by_province,
    churn_geographic_by_province,
)
from .opportunity_analysis import opportunity_score_by_province
from .expansion_analysis import expansion_index_by_province
from .network_analysis import distance_matrix, nearest_branch_assignment
from .logistics_analysis import coverage_radius_distribution, logistics_efficiency_score
from .territorial_clustering import territorial_clusters, expansion_recommendations
from .spatial_operations import coverage_buffers, real_coverage_by_client
from .voronoi_analysis import voronoi_territories
from .hotspot_analysis import commercial_hotspots, candidate_branches
from .cost_model import transport_costs_by_route, route_risk
from .fleet_simulation import depot_load
from .routing_engine import simulate_expansion

ROOT    = Path(__file__).parent.parent
OUT_DIR = ROOT / "data" / "gis_outputs"


def _write(name: str, data: object) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dst = OUT_DIR / name
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    print(f"  OK  {dst.name}  ({dst.stat().st_size // 1024} KB)")


def generate_coverage_score() -> None:
    df = coverage_score_by_province()
    _write("coverage_score.json", df.to_dict("records"))


def generate_opportunity_score() -> None:
    df = opportunity_score_by_province()
    _write("opportunity_score.json", df.to_dict("records"))


def generate_expansion_targets() -> None:
    df = expansion_index_by_province()
    _write("expansion_targets.json", df.to_dict("records"))


def generate_revenue_density() -> None:
    df = revenue_density_by_province()
    _write("revenue_density.json", df.to_dict("records"))


def generate_churn_by_province() -> None:
    df = churn_geographic_by_province()
    _write("churn_by_province.json", df.to_dict("records"))


def generate_distance_matrix() -> None:
    _write("distance_matrix.json", distance_matrix())


def generate_nearest_branch() -> None:
    _write("nearest_branch.json", nearest_branch_assignment())


def generate_coverage_distribution() -> None:
    _write("coverage_distribution.json", coverage_radius_distribution())


def generate_logistics_score() -> None:
    df = logistics_efficiency_score()
    _write("logistics_score.json", df.to_dict("records"))


def generate_territorial_clusters() -> None:
    _write("territorial_clusters.json", territorial_clusters())


def generate_expansion_recommendations() -> None:
    _write("expansion_recommendations.json", expansion_recommendations())


def generate_coverage_buffers() -> None:
    _write("coverage_buffers.geojson", coverage_buffers())


def generate_real_coverage() -> None:
    _write("real_coverage.json", real_coverage_by_client())


def generate_voronoi_territories() -> None:
    _write("territories.geojson", voronoi_territories())


def generate_hotspots() -> None:
    _write("hotspots.geojson", commercial_hotspots())


def generate_candidate_branches() -> None:
    _write("candidate_branches.geojson", candidate_branches())


def generate_transport_costs() -> None:
    _write("transport_costs.json", transport_costs_by_route())


def generate_depot_load() -> None:
    _write("depot_load.json", depot_load())


def generate_route_risk() -> None:
    _write("route_risk.json", route_risk())


def generate_expansion_simulations() -> None:
    _write("expansion_simulations.json", simulate_expansion())


def run_all() -> None:
    print("AgroNova GIS — Generating analytics JSON files")
    print(f"Output: {OUT_DIR}")
    print("-" * 55)
    generate_coverage_score()
    generate_opportunity_score()
    generate_expansion_targets()
    generate_revenue_density()
    generate_churn_by_province()
    generate_distance_matrix()
    generate_nearest_branch()
    generate_coverage_distribution()
    generate_logistics_score()
    generate_territorial_clusters()
    generate_expansion_recommendations()
    generate_coverage_buffers()
    generate_real_coverage()
    generate_voronoi_territories()
    generate_hotspots()
    generate_candidate_branches()
    generate_transport_costs()
    generate_depot_load()
    generate_route_risk()
    generate_expansion_simulations()
    print("-" * 55)
    print("Done.")


if __name__ == "__main__":
    run_all()
