from fastapi import APIRouter, Query
from app.services.route_service import recommend_routes

router = APIRouter(tags=["智能路径"])


@router.get("/route/recommend")
def route_recommendation(city: str = Query("beijing"), origin: str = Query("beijing_station"), destination: str = Query("national_stadium")):
    return recommend_routes(city=city, origin=origin, destination=destination)
