from datetime import datetime

from fastapi import HTTPException

from app.services.route_service import recommend_routes
from app.services.traffic_service import get_dashboard_summary, get_traffic_events, get_traffic_segments
from app.services.warning_service import get_warnings


PEAK_TIMES = {"beijing": "17:30", "xiamen": "17:45", "fuzhou": "17:30"}
LINE_CATALOG = {
    "beijing": [{"line_id": "line_beijing_core_01", "name": "核心区晚高峰接驳线", "departure_times": ["17:30", "18:00", "18:30"], "remaining_seats": 28}],
    "xiamen": [{"line_id": "line_xiamen_island_01", "name": "岛内外错峰通勤线", "departure_times": ["17:45", "18:15", "18:45"], "remaining_seats": 32}],
    "fuzhou": [{"line_id": "line_fuzhou_station_01", "name": "站城协同通勤线", "departure_times": ["17:30", "18:00", "18:30"], "remaining_seats": 25}],
}

_routes: dict[str, dict] = {}
_bookings: set[str] = set()
_line_seats: dict[str, int] = {}


def _now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def get_home_summary(city: str):
    summary = get_dashboard_summary(city)
    warnings = get_warnings(city)
    weather = next((item for item in warnings if item["type"] == "weather"), None)
    high_risk = sum(item["level"] in {"red", "orange"} for item in warnings)
    safety = max(0, min(100, round(100 - summary["congestion_index"] * .25 - high_risk * 6 - (4 if weather else 0))))
    return {
        "city": city,
        "travel_safety_index": safety,
        "weather_notice": weather["impact"] if weather else "当前暂无显著天气风险",
        "peak_notice": f"晚高峰预计{PEAK_TIMES.get(city, '17:30')}开启，建议提早20分钟出行",
        "recommended_transport": ["subway", "bus"] if summary["congestion_index"] >= 60 or weather else ["subway", "shared_bike"],
        "updated_at": _now(),
        "data_mode": "simulation",
    }


def create_smart_plan(city: str, origin: str, destination: str, preference: str):
    routes = recommend_routes(city, origin, destination)
    strategy = {"fastest": "fastest", "congestion_avoid": "low_congestion", "safe_first": "safe"}[preference]
    selected = next((item for item in routes["items"] if item["strategy"] == strategy), routes["items"][0])
    segments = get_traffic_segments(city)
    risks = [item for item in segments if item["congestion_index"] >= 60 or item["weather_factor"] >= 30 or item["event_factor"] >= 35]
    avoided = [f"已避开{item['name']}天气/事件风险" for item in risks[:2 if preference == "safe_first" else 1]]
    start_index = {"fastest": 0, "congestion_avoid": 1, "safe_first": 2}[preference]
    nodes = [routes["origin"]["name"], *[item["name"] for item in segments[start_index:start_index + 2]], routes["destination"]["name"]]
    route_id = f"rt_{city}_{len(_routes) + 1:04d}"
    plan = {
        "route_id": route_id, "city": city, "strategy": preference,
        "total_distance_km": selected["distance_km"], "estimated_minutes": selected["estimated_minutes"],
        "avoided_risks": avoided, "path_nodes": nodes, "path": selected["path"],
        "data_mode": "simulation",
    }
    _routes[route_id] = plan
    return plan


def monitor_trip(route_id: str):
    plan = _routes.get(route_id)
    if not plan:
        raise HTTPException(status_code=404, detail="路线已失效，请重新规划")
    segments = get_traffic_segments(plan["city"])
    risk = None if plan["strategy"] == "safe_first" else next(
        (item for item in segments if item["name"] in plan["path_nodes"] and (item["congestion_index"] >= 60 or item["weather_factor"] >= 30 or item["event_factor"] >= 35)),
        None,
    )
    if not risk:
        return {"route_id": route_id, "has_risk_ahead": False, "risk_type": None, "description": "当前路线暂无显著风险", "reroute_available": False, "updated_at": _now(), "data_mode": "simulation"}
    risk_type = "waterlog" if risk["weather_factor"] >= 30 else "accident" if risk["event_factor"] >= 35 else "congestion"
    return {
        "route_id": route_id, "has_risk_ahead": True, "risk_type": risk_type,
        "description": f"前方{risk['name']}存在通行风险，建议切换备选路线",
        "reroute_available": True, "next_risk_segment": risk["name"], "distance_to_risk_km": 1.5,
        "updated_at": _now(), "data_mode": "simulation",
    }


def get_commute_lines(city: str):
    get_dashboard_summary(city)
    return [{**line, "remaining_seats": _line_seats.get(line["line_id"], line["remaining_seats"])} for line in LINE_CATALOG[city]]


def book_commute(city: str, user_id: str, line_id: str, shift_time: str):
    line = next((item for item in get_commute_lines(city) if item["line_id"] == line_id), None)
    if not line:
        raise HTTPException(status_code=404, detail="当前城市暂无该通勤线路")
    if shift_time not in line["departure_times"]:
        raise HTTPException(status_code=400, detail="该线路暂无此班次")
    booking_key = f"{city}:{user_id}:{line_id}:{shift_time}"
    if booking_key in _bookings:
        raise HTTPException(status_code=409, detail="该用户已预约此班次")
    if line["remaining_seats"] <= 0:
        raise HTTPException(status_code=409, detail="当前班次已满")
    _bookings.add(booking_key)
    remaining = line["remaining_seats"] - 1
    _line_seats[line_id] = remaining
    return {
        "booking_id": f"bk_{city}_{len(_bookings):04d}", "city": city, "user_id": user_id,
        "line_id": line_id, "shift_time": shift_time, "status": "confirmed", "remaining_seats": remaining,
        "message": "预约成功，请提前10分钟到达候车点", "data_mode": "simulation",
    }
