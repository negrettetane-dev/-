from fastapi import APIRouter, Query

from app.models.schemas import SmsCodeRequest, SmsLoginRequest
from app.services.mobility_service import get_weather, nearby_places, request_sms_code, search_places, taxi_estimate, verify_sms_code
from app.services.city_service import ensure_city, get_supported_cities
from app.services.traffic_service import get_traffic_events, get_traffic_segments


router = APIRouter(prefix="/mobility", tags=["融合出行服务"])

def offline_package(city: str):
    """Build a portable snapshot that the web client can retain for offline use."""
    ensure_city(city)
    city_info = next(item for item in get_supported_cities() if item["code"] == city)
    return {
        "format": "zhitu-offline-snapshot/v1",
        "city": city,
        "version": "2026.08.04",
        "data_mode": "simulation",
        "city_info": city_info,
        "segments": get_traffic_segments(city),
        "events": get_traffic_events(city),
    }


@router.get("/offline-packs")
def list_offline_packs():
    items = []
    for city in get_supported_cities():
        package = offline_package(city["code"])
        items.append({
            "city": city["code"], "name": city["name"], "version": package["version"],
            "size_bytes": len(str(package).encode("utf-8")),
            "download_url": f"/api/mobility/offline-packs/{city['code']}",
            "contents": ["road-network", "traffic-snapshot", "events", "poi-index"],
        })
    return {"items": items}


@router.get("/offline-packs/{city}")
def download_offline_pack(city: str):
    return offline_package(city)


@router.get("/search")
def search(city: str = Query("beijing"), q: str = Query(min_length=1, max_length=50)):
    return {"items": search_places(city, q)}


@router.get("/nearby")
def nearby(city: str = Query("beijing"), lng: float = Query(ge=-180, le=180), lat: float = Query(ge=-90, le=90), category: str = Query("all")):
    return {"items": nearby_places(city, lng, lat, category)}


@router.get("/weather")
def weather(city: str = Query("beijing")):
    return get_weather(city)


@router.get("/taxi-estimate")
def taxi(city: str = Query("beijing"), origin_lng: float = Query(ge=-180, le=180), origin_lat: float = Query(ge=-90, le=90), destination_lng: float = Query(ge=-180, le=180), destination_lat: float = Query(ge=-90, le=90)):
    return taxi_estimate(city, origin_lng, origin_lat, destination_lng, destination_lat)


@router.post("/auth/request-code")
def auth_request_code(payload: SmsCodeRequest):
    return request_sms_code(payload.phone)


@router.post("/auth/verify-code")
def auth_verify_code(payload: SmsLoginRequest):
    return verify_sms_code(payload.phone, payload.code)
