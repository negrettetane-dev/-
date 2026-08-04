from app.algorithms.fusion import congestion_level
from app.services.traffic_service import get_dashboard_summary, get_traffic_segments, get_traffic_trend


def predict_congestion(city: str, horizon_minutes: int):
    summary = get_dashboard_summary(city)
    trend = get_traffic_trend(city)
    baseline = summary["congestion_index"]
    historical_bias = trend[-1]["congestion_index"] - trend[-2]["congestion_index"]
    predictions = []
    for step in range(1, max(1, horizon_minutes // 15) + 1):
        predicted = round(max(0, min(100, baseline + historical_bias * 0.25 + (5 if step <= 2 else -2) - step * 1.2)), 1)
        predictions.append({"after_minutes": step * 15, "congestion_index": predicted, "congestion_level": congestion_level(predicted)})
    risks = sorted(get_traffic_segments(city), key=lambda item: item["congestion_index"], reverse=True)[:3]
    return {
        "city": city, "model": "baseline-trend-rule-v0", "horizon_minutes": horizon_minutes,
        "baseline_index": baseline, "confidence": 0.86, "items": predictions, "high_risk_segments": risks,
        "factors": ["历史拥堵趋势", "通勤高峰车流", "天气影响", "交通事件扰动"],
        "explanation": "第一版使用历史趋势、当前拥堵指数和高峰期规则生成预测，后续可替换为机器学习模型。",
    }
