from fastapi import HTTPException

from app.algorithms.fusion import calculate_congestion_index
from app.models.schemas import WhatIfSimulationRequest
from app.services.city_service import ensure_city
from app.services.traffic_service import get_traffic_segments


ROAD_GRAPHS = {
    "beijing": {
        "东长安街": ["前门东路", "二环东段"],
        "前门东路": ["东长安街", "二环东段", "地安门外大街"],
        "地安门外大街": ["前门东路", "鼓楼西大街", "北辰路"],
        "北辰路": ["地安门外大街", "奥林匹克公园中路", "二环东段"],
        "二环东段": ["东长安街", "前门东路", "北辰路"],
        "鼓楼西大街": ["地安门外大街"],
        "奥林匹克公园中路": ["北辰路"],
    },
    "xiamen": {
        "鹭江道": ["湖滨南路", "厦禾路", "中山路旅游走廊"],
        "湖滨南路": ["鹭江道", "厦禾路", "明发商业街联络线"],
        "厦禾路": ["鹭江道", "湖滨南路", "杏林大桥"],
        "环岛东路": ["明发商业街联络线", "杏林大桥"],
        "杏林大桥": ["厦禾路", "环岛东路"],
        "中山路旅游走廊": ["鹭江道"],
        "明发商业街联络线": ["湖滨南路", "环岛东路"],
    },
    "fuzhou": {
        "东街口": ["五一北路", "金山大道"],
        "五一北路": ["东街口", "三环快速路", "鼓山隧道"],
        "金山大道": ["东街口", "闽江大道", "三环快速路"],
        "三环快速路": ["五一北路", "金山大道", "鼓山隧道"],
        "闽江大道": ["金山大道", "福州南站通勤线"],
        "福州南站通勤线": ["闽江大道", "三环快速路"],
        "鼓山隧道": ["五一北路", "三环快速路"],
    },
}

SEGMENT_LENGTHS = {
    "beijing": {"东长安街": 3.1, "前门东路": 2.4, "地安门外大街": 2.8, "北辰路": 3.7, "二环东段": 4.2, "鼓楼西大街": 2.1, "奥林匹克公园中路": 2.6},
    "xiamen": {"鹭江道": 2.8, "湖滨南路": 3.6, "厦禾路": 2.2, "环岛东路": 4.5, "杏林大桥": 3.9, "中山路旅游走廊": 1.4, "明发商业街联络线": 2.1},
    "fuzhou": {"东街口": 1.8, "五一北路": 3.2, "金山大道": 4.1, "三环快速路": 6.3, "闽江大道": 3.4, "福州南站通勤线": 4.7, "鼓山隧道": 2.9},
}


def _severity(request: WhatIfSimulationRequest) -> float:
    if request.event_type == "waterlog":
        depth = request.water_depth_cm if request.water_depth_cm is not None else 20
        return min(1.0, max(0.25, depth / 60))
    return 0.78


def _dynamic_cost(city: str, segment: dict, severity: float, direct_impact: bool) -> float:
    length = SEGMENT_LENGTHS[city].get(segment["name"], 3.0)
    speed = max(segment["average_speed"], 5)
    congestion_index = calculate_congestion_index(
        segment["average_speed"], segment["flow"], segment["weather_factor"], segment["event_factor"],
    ) / 100
    water_or_event_penalty = severity * (1.1 if direct_impact else 0.42)
    return round(length / speed * (1 + congestion_index) + water_or_event_penalty, 3)


def _affected_segments(city: str, target: str, segments_by_name: dict[str, dict], severity: float) -> list[str]:
    neighbors = ROAD_GRAPHS[city].get(target, [])
    ranked = []
    for name in [target, *neighbors]:
        segment = segments_by_name.get(name)
        if not segment:
            continue
        cost = _dynamic_cost(city, segment, severity, direct_impact=name == target)
        ranked.append((name, cost))
    ranked.sort(key=lambda item: item[1], reverse=True)
    return [name for name, _ in ranked[:4]] or [target]


def _sop_actions(request: WhatIfSimulationRequest, affected: list[str], severity: float) -> list[str]:
    if request.event_type == "waterlog":
        actions = [
            f"对{request.target_segment}启动积水警戒，联动排水与交警巡查。",
            "将受影响方向信号绿灯延长10-15秒，优先保障主通道排队消散。",
        ]
    else:
        actions = [
            f"对{request.target_segment}启动事故快处与远端诱导分流。",
            "开放相邻路段绕行方案，并下发导航平台避让提示。",
        ]
    if severity >= 0.65:
        actions.append("启动重点区域错峰诱导屏，提示通勤车辆分批离开高风险路段。")
    if len(affected) >= 3:
        actions.append("联动相邻路口信号配时，避免拥堵向上游路网反灌。")
    return actions[:4]


def run_what_if_simulation(request: WhatIfSimulationRequest):
    ensure_city(request.city)
    segments = get_traffic_segments(request.city)
    segments_by_name = {segment["name"]: segment for segment in segments}
    if request.target_segment not in segments_by_name:
        raise HTTPException(status_code=404, detail=f"未知路段：{request.target_segment}")

    target = segments_by_name[request.target_segment]
    severity = _severity(request)
    impact_ratio = min(0.72, 0.34 + severity * 0.38)
    recovery_ratio = 0.52 if request.event_type == "waterlog" else 0.46
    before_speed = round(target["average_speed"], 1)
    after_speed = round(max(5, before_speed * (1 - impact_ratio)), 1)
    optimized_speed = round(after_speed + (before_speed - after_speed) * recovery_ratio, 1)
    affected = _affected_segments(request.city, request.target_segment, segments_by_name, severity)

    base_spread = target["congestion_index"] / 100 + severity * 0.9
    spread_trend = [
        round(base_spread * 1.0, 1),
        round(base_spread * (1.45 + severity * 0.25), 1),
        round(base_spread * (1.85 + severity * 0.4), 1),
    ]

    return {
        "code": 200,
        "data": {
            "affected_segments": affected,
            "spread_trend": spread_trend,
            "comparison": {
                "before_speed_kmh": before_speed,
                "after_speed_kmh": after_speed,
                "optimized_speed_kmh": optimized_speed,
            },
            "sop_actions": _sop_actions(request, affected, severity),
        },
    }
