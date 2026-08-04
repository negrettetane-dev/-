from datetime import datetime
from math import asin, cos, radians, sin, sqrt

from fastapi import HTTPException

from app.core.config import CITY_CONFIG
from app.services.city_service import ensure_city
from app.services.sample_data import POIS


CATEGORY_NAMES = {
    "transit": ["地铁换乘站", "公交枢纽"],
    "parking": ["智慧停车场", "P+R停车场"],
    "food": ["城市餐饮街区", "便民餐饮中心"],
    "hotel": ["城市商务酒店", "交通驿站"],
    "hospital": ["城市综合医院", "社区医疗中心"],
    "charging": ["新能源充电站", "快速充电中心"],
}
WEATHER = {
    "beijing": {"condition": "阵雨", "temperature_c": 27, "feels_like_c": 29, "humidity": 72, "wind": "东南风 3级", "visibility_km": 8, "advice": "午后短时降雨，慢行出行注意路面湿滑。"},
    "xiamen": {"condition": "多云有阵雨", "temperature_c": 30, "feels_like_c": 33, "humidity": 78, "wind": "东风 4级", "visibility_km": 10, "advice": "跨岛通道侧风较强，骑行请降低速度。"},
    "fuzhou": {"condition": "中雨", "temperature_c": 28, "feels_like_c": 31, "humidity": 84, "wind": "东北风 2级", "visibility_km": 6, "advice": "低洼路段存在积水风险，优先选择公共交通。"},
}
_sms_codes: dict[str, str] = {}


def _distance_km(lng1: float, lat1: float, lng2: float, lat2: float) -> float:
    dlng, dlat = radians(lng2 - lng1), radians(lat2 - lat1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 6371 * 2 * asin(sqrt(a))


def _catalog(city: str):
    ensure_city(city)
    base = [{"id": key, **value, "category": "landmark", "address": f"{CITY_CONFIG[city]['name']}重点区域"} for key, value in POIS[city].items()]
    center = CITY_CONFIG[city]["center"]
    generated = []
    index = 0
    for category, names in CATEGORY_NAMES.items():
        for name in names:
            index += 1
            generated.append({
                "id": f"{city}-{category}-{index}", "name": name, "category": category,
                "address": f"{CITY_CONFIG[city]['districts'][index % len(CITY_CONFIG[city]['districts'])]}示范点",
                "lng": round(center["lng"] + ((index % 4) - 1.5) * .009, 6),
                "lat": round(center["lat"] + ((index % 3) - 1) * .008, 6),
            })
    return base + generated


def search_places(city: str, query: str):
    query = query.strip().lower()
    if not query:
        return []
    return [item for item in _catalog(city) if query in item["name"].lower() or query in item["address"].lower()][:10]


def nearby_places(city: str, lng: float, lat: float, category: str | None):
    items = []
    for item in _catalog(city):
        if category and category != "all" and item["category"] != category:
            continue
        distance = _distance_km(lng, lat, item["lng"], item["lat"])
        items.append({**item, "distance_km": round(distance, 2), "walking_minutes": max(1, round(distance / 4.5 * 60))})
    return sorted(items, key=lambda item: item["distance_km"])[:12]


def get_weather(city: str):
    ensure_city(city)
    return {"city": city, **WEATHER[city], "updated_at": datetime.now().astimezone().isoformat(timespec="minutes"), "data_mode": "simulation"}


def taxi_estimate(city: str, origin_lng: float, origin_lat: float, destination_lng: float, destination_lat: float):
    ensure_city(city)
    straight = _distance_km(origin_lng, origin_lat, destination_lng, destination_lat)
    distance = round(max(.8, straight * 1.25), 1)
    duration = max(4, round(distance / 28 * 60 + 3))
    return {
        "city": city, "distance_km": distance, "estimated_minutes": duration,
        "estimated_fare_yuan": round(13 + max(0, distance - 3) * 2.4, 1),
        "surge_level": "normal", "data_mode": "simulation",
    }


def request_sms_code(phone: str):
    code = "246810"
    _sms_codes[phone] = code
    return {"challenge_id": f"sms-{phone[-4:]}", "expires_in_seconds": 300, "demo_code": code, "data_mode": "simulation"}


def verify_sms_code(phone: str, code: str):
    if _sms_codes.get(phone) != code:
        raise HTTPException(status_code=400, detail="验证码无效或已过期")
    _sms_codes.pop(phone, None)
    return {"user_id": f"user-{phone[-6:]}", "masked_phone": f"{phone[:3]}****{phone[-4:]}", "display_name": "智途用户", "token": f"demo-session-{phone[-6:]}", "data_mode": "simulation"}
