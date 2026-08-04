from fastapi import HTTPException
from app.services.city_service import ensure_city
from app.services.sample_data import POIS


def _point(city: str, key: str):
    if key not in POIS[city]:
        raise HTTPException(status_code=404, detail=f"未知地点：{key}")
    return POIS[city][key]


def recommend_routes(city: str, origin: str, destination: str):
    ensure_city(city)
    if origin == destination:
        raise HTTPException(status_code=400, detail="起点和终点不能相同")
    start, end = _point(city, origin), _point(city, destination)
    mid = {"lng": round((start["lng"] + end["lng"]) / 2, 6), "lat": round((start["lat"] + end["lat"]) / 2 + 0.012, 6)}
    def path(via):
        return [{"lng": start["lng"], "lat": start["lat"]}, via, {"lng": end["lng"], "lat": end["lat"]}]
    return {"city": city, "origin": {"id": origin, **start}, "destination": {"id": destination, **end}, "items": [
        {"strategy": "fastest", "title": "最快路线", "distance_km": 12.8, "estimated_minutes": 24, "congestion_score": 61.5, "safety_score": 82.0, "path": path(mid), "advice": "适合时间优先，需关注目的地入口的短时排队。"},
        {"strategy": "low_congestion", "title": "低拥堵路线", "distance_km": 15.3, "estimated_minutes": 29, "congestion_score": 38.4, "safety_score": 86.5, "path": path({"lng": start["lng"] + 0.018, "lat": start["lat"] + 0.020}), "advice": "主动绕开高风险路段，适合早晚高峰通行。"},
        {"strategy": "safe", "title": "安全路线", "distance_km": 16.1, "estimated_minutes": 32, "congestion_score": 44.2, "safety_score": 93.0, "path": path({"lng": start["lng"] + 0.010, "lat": start["lat"] - 0.018}), "advice": "避开天气影响区域，适合复杂天气和安全优先场景。"},
    ]}
