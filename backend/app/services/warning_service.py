from app.services.traffic_service import get_traffic_segments
from app.core.config import CITY_CONFIG


def get_warnings(city: str):
    warnings = []
    for segment in get_traffic_segments(city):
        if segment["congestion_index"] >= 60:
            warnings.append({
                "id": f"w-{segment['id']}", "type": "congestion",
                "level": "red" if segment["congestion_index"] >= 75 else "orange",
                "title": f"{segment['name']}拥堵风险上升", "district": segment["district"],
                "segment_id": segment["id"], "status": "active", "occurred_at": "2026-07-20 09:20",
                "impact": "通行速度下降，可能出现排队。", "suggestion": "建议启动绕行诱导，并加强高峰期路口疏导。",
            })
    district = CITY_CONFIG[city]["districts"][0]
    warnings.append({"id": f"w-weather-{city}", "type": "weather", "level": "yellow", "title": "强降雨天气交通风险提示", "district": district, "segment_id": None, "status": "active", "occurred_at": "2026-07-20 08:55", "impact": "路面湿滑，低洼路段存在积水风险。", "suggestion": "建议提高安全路线权重，并避开积水风险路段。"})
    return warnings
