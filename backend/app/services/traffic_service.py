from statistics import mean
from app.algorithms.fusion import calculate_congestion_index, congestion_level
from app.services.city_service import ensure_city
from app.services.sample_data import EVENTS, SEGMENTS, TREND


def get_traffic_segments(city: str):
    ensure_city(city)
    items = []
    for segment in SEGMENTS[city]:
        index = calculate_congestion_index(segment["average_speed"], segment["flow"], segment["weather_factor"], segment["event_factor"])
        items.append({**segment, "congestion_index": index, "congestion_level": congestion_level(index)})
    return items


def get_traffic_events(city: str):
    ensure_city(city)
    return EVENTS[city]


def get_traffic_trend(city: str):
    ensure_city(city)
    return TREND[city]


def get_dashboard_summary(city: str):
    segments = get_traffic_segments(city)
    events = get_traffic_events(city)
    index = round(mean(item["congestion_index"] for item in segments), 1)
    return {
        "city": city, "congestion_index": index, "congestion_level": congestion_level(index),
        "average_speed": round(mean(item["average_speed"] for item in segments), 1),
        "active_events": len(events), "monitored_segments": len(segments),
        "congested_segments": sum(item["congestion_index"] >= 60 for item in segments),
        "updated_at": "2026-07-20T09:30:00+08:00", "data_mode": "simulation",
        "top_congested": sorted(segments, key=lambda item: item["congestion_index"], reverse=True)[:5],
    }
