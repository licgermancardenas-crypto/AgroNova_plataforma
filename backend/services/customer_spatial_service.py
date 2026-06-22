from __future__ import annotations

from sqlalchemy.orm import Session

from backend.repositories.customer_spatial_repository import CustomerSpatialRepository
from backend.schemas.customer_spatial import (
    CustomerGeo, CustomerDetail, CustomerStats, CustomersResponse, NearbyResponse,
)


class CustomerSpatialService:
    def __init__(self, db: Session):
        self.repo = CustomerSpatialRepository(db)

    def list_customers(
        self,
        provincia:  str | None = None,
        segmento:   str | None = None,
        tier:       str | None = None,
        churn_lvl:  str | None = None,
    ) -> CustomersResponse:
        rows = self.repo.get_all(provincia=provincia, segmento=segmento,
                                  tier=tier, churn_lvl=churn_lvl)
        items = [CustomerGeo(**r) for r in rows]
        return CustomersResponse(total=len(items), items=items)

    def search_customers(
        self,
        q:         str = "",
        provincia: str | None = None,
        ciudad:    str | None = None,
        segmento:  str | None = None,
        limit:     int = 50,
    ) -> list[CustomerGeo]:
        rows = self.repo.search(q=q, provincia=provincia, ciudad=ciudad,
                                 segmento=segmento, limit=limit)
        return [CustomerGeo(**r) for r in rows]

    def get_customer(self, cliente_id: str) -> CustomerDetail | None:
        row = self.repo.get_by_id(cliente_id)
        if not row:
            return None

        monthly  = self.repo.monthly_revenue(cliente_id)
        quarters = self.repo.quarterly_orders(cliente_id)
        branch   = self.repo.nearest_branch_for(row["lat"], row["lon"])

        return CustomerDetail(
            **row,
            revenue_mensual=monthly,
            compras_trim=quarters,
            nearest_branch=branch,
        )

    def get_nearby(
        self,
        lat:       float,
        lon:       float,
        radius_km: float = 50.0,
    ) -> NearbyResponse:
        rows = self.repo.get_nearby(lat=lat, lon=lon, radius_km=radius_km)
        items = [CustomerGeo(**{k: v for k, v in r.items() if k != "distance_km"}) for r in rows]
        return NearbyResponse(query_lat=lat, query_lon=lon, radius_km=radius_km,
                               total=len(items), items=items)

    def get_stats(self) -> CustomerStats:
        data = self.repo.get_stats()
        return CustomerStats(**data)
