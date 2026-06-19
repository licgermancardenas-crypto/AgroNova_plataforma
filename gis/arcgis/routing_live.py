"""
AgroNova GIS-14 — routing_live.py

Convenience wrappers over routing.route() with named functions
matching the GIS-14 API contract.

Functions:
    calculate_route(from_loc, to_loc)   → RouteResult
    route_distance(from_loc, to_loc)    → float (km)
    travel_time(from_loc, to_loc)       → float (minutes)
    multi_stop_route(*waypoints)        → RouteResult

Fallback: Haversine straight-line approximation (local mode).
"""
from __future__ import annotations

from .routing import Waypoint, RouteResult, route


def calculate_route(from_loc: Waypoint, to_loc: Waypoint) -> RouteResult:
    """
    Calculate the optimal road route between two locations.

    Args:
        from_loc: Origin  {"name": str, "lat": float, "lon": float}
        to_loc:   Dest    {"name": str, "lat": float, "lon": float}

    Returns:
        RouteResult with total_km, total_min, segments, geometry.
    """
    return route([from_loc, to_loc])


def route_distance(from_loc: Waypoint, to_loc: Waypoint) -> float:
    """
    Road distance in km between two locations.

    Returns Haversine approximation when ArcGIS is not configured.
    """
    return route([from_loc, to_loc])["total_km"]


def travel_time(from_loc: Waypoint, to_loc: Waypoint) -> float:
    """
    Estimated travel time in minutes between two locations.

    Assumes ~80 km/h average in local mode.
    """
    return route([from_loc, to_loc])["total_min"]


def multi_stop_route(*waypoints: Waypoint) -> RouteResult:
    """
    Compute an ordered route through 3 or more waypoints.

    Args:
        *waypoints: Two or more Waypoint dicts in visit order.
    """
    if len(waypoints) < 2:
        raise ValueError("multi_stop_route requires at least 2 waypoints.")
    return route(list(waypoints))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json
    bsas  = {"name": "Buenos Aires", "lat": -34.603, "lon": -58.381}
    rsa   = {"name": "Rosario",      "lat": -32.947, "lon": -60.639}
    cba   = {"name": "Córdoba",      "lat": -31.413, "lon": -64.181}

    print("=== calculate_route ===")
    print(json.dumps(calculate_route(bsas, rsa), ensure_ascii=False, indent=2))

    print(f"\n=== route_distance : {route_distance(bsas, rsa):.1f} km ===")
    print(f"=== travel_time    : {travel_time(bsas, rsa):.0f} min ===")

    print("\n=== multi_stop_route ===")
    result = multi_stop_route(bsas, rsa, cba)
    print(f"Total: {result['total_km']:.0f} km  /  {result['total_min']:.0f} min")
