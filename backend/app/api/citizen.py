from fastapi import APIRouter, Query

from app.models.schemas import CitizenBusBookingRequest, CitizenSmartPlanRequest
from app.services.citizen_service import book_commute, create_smart_plan, get_commute_lines, get_home_summary, monitor_trip


router = APIRouter(prefix="/citizen", tags=["市民出行"])


@router.get("/home-summary")
def home_summary(city: str = Query("beijing")):
    return get_home_summary(city)


@router.post("/route/smart-plan")
def smart_plan(payload: CitizenSmartPlanRequest):
    return create_smart_plan(payload.city, payload.origin, payload.destination, payload.preference)


@router.get("/trip/monitor")
def trip_monitor(route_id: str):
    return monitor_trip(route_id)


@router.get("/commute/lines")
def commute_lines(city: str = Query("beijing")):
    return {"items": get_commute_lines(city)}


@router.post("/commute/bus-booking")
def commute_booking(payload: CitizenBusBookingRequest):
    return book_commute(payload.city, payload.user_id, payload.line_id, payload.shift_time)
