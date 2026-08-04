from fastapi import APIRouter, Query
from app.services.traffic_service import get_dashboard_summary, get_traffic_events, get_traffic_segments, get_traffic_trend

router = APIRouter(tags=["交通态势"])


@router.get("/traffic/summary")
def traffic_summary(city: str = Query("beijing")):
    return get_dashboard_summary(city)


@router.get("/traffic/segments")
def traffic_segments(city: str = Query("beijing")):
    return {"items": get_traffic_segments(city)}


@router.get("/traffic/events")
def traffic_events(city: str = Query("beijing")):
    return {"items": get_traffic_events(city)}


@router.get("/traffic/trend")
def traffic_trend(city: str = Query("beijing")):
    return {"items": get_traffic_trend(city)}
