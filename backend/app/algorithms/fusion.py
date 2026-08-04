def congestion_level(index: float) -> str:
    if index < 35:
        return "畅通"
    if index < 60:
        return "缓行"
    if index < 80:
        return "拥堵"
    return "严重拥堵"


def calculate_congestion_index(average_speed: float, flow: int, weather_factor: float, event_factor: float) -> float:
    speed_score = max(0, min(100, (50 - average_speed) * 2.1))
    flow_score = max(0, min(100, flow / 18))
    raw = speed_score * 0.45 + flow_score * 0.35 + weather_factor * 0.1 + event_factor * 0.1
    return round(max(0, min(100, raw)), 1)
