from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_core_endpoints():
    cities = client.get("/api/cities").json()["items"]
    assert {city["code"] for city in cities} == {"beijing", "xiamen", "fuzhou"}
    for city in cities:
        code = city["code"]
        pois = city["pois"]
        paths = [
            f"/api/traffic/summary?city={code}", f"/api/traffic/segments?city={code}",
            f"/api/traffic/events?city={code}", f"/api/traffic/trend?city={code}",
            f"/api/prediction/congestion?city={code}&horizon_minutes=60",
            f"/api/route/recommend?city={code}&origin={pois[0]['id']}&destination={pois[1]['id']}",
            f"/api/warning/active?city={code}",
        ]
        for path in paths:
            assert client.get(path).status_code == 200, path


def test_invalid_inputs():
    assert client.get("/api/traffic/summary?city=unknown").status_code == 404
    assert client.get("/api/route/recommend?city=beijing&origin=beijing_station&destination=beijing_station").status_code == 400
    assert client.get("/api/route/recommend?city=beijing&origin=missing&destination=palace_museum").status_code == 404


def test_what_if_simulation_waterlog():
    response = client.post("/api/simulation/what-if", json={
        "city": "beijing",
        "event_type": "waterlog",
        "target_segment": "东长安街",
        "water_depth_cm": 30,
    })
    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == 200
    assert "东长安街" in payload["data"]["affected_segments"]
    assert len(payload["data"]["spread_trend"]) == 3
    assert payload["data"]["comparison"]["after_speed_kmh"] < payload["data"]["comparison"]["before_speed_kmh"]
    assert payload["data"]["comparison"]["optimized_speed_kmh"] > payload["data"]["comparison"]["after_speed_kmh"]
    assert payload["data"]["sop_actions"]


def test_what_if_simulation_invalid_segment():
    response = client.post("/api/simulation/what-if", json={
        "city": "xiamen",
        "event_type": "accident",
        "target_segment": "不存在路段",
    })
    assert response.status_code == 404


def test_mobility_search_nearby_weather_and_taxi():
    search = client.get("/api/mobility/search?city=beijing&q=北京站")
    assert search.status_code == 200
    assert search.json()["items"][0]["name"] == "北京站"
    nearby = client.get("/api/mobility/nearby?city=beijing&lng=116.397&lat=39.933&category=parking")
    assert nearby.status_code == 200
    assert nearby.json()["items"]
    assert all(item["category"] == "parking" for item in nearby.json()["items"])
    assert client.get("/api/mobility/weather?city=xiamen").status_code == 200
    taxi = client.get("/api/mobility/taxi-estimate?city=beijing&origin_lng=116.397&origin_lat=39.933&destination_lng=116.427&destination_lat=39.904")
    assert taxi.status_code == 200
    assert taxi.json()["estimated_fare_yuan"] >= 13


def test_offline_map_pack_contains_city_snapshot():
    manifests = client.get("/api/mobility/offline-packs")
    assert manifests.status_code == 200
    item = next(item for item in manifests.json()["items"] if item["city"] == "beijing")
    assert item["size_bytes"] > 0
    package = client.get("/api/mobility/offline-packs/beijing")
    assert package.status_code == 200
    payload = package.json()
    assert payload["format"] == "zhitu-offline-snapshot/v1"
    assert payload["segments"]
    assert payload["city_info"]["code"] == "beijing"


def test_citizen_flow_and_demo_login():
    payload = {"city": "beijing", "origin": "beijing_station", "destination": "national_stadium", "preference": "fastest"}
    plan = client.post("/api/citizen/route/smart-plan", json=payload)
    assert plan.status_code == 200
    route_id = plan.json()["route_id"]
    assert client.get(f"/api/citizen/trip/monitor?route_id={route_id}").status_code == 200
    assert client.get("/api/citizen/home-summary?city=beijing").status_code == 200
    lines = client.get("/api/citizen/commute/lines?city=beijing").json()["items"]
    booking = client.post("/api/citizen/commute/bus-booking", json={"city": "beijing", "user_id": "pytest-user", "line_id": lines[0]["line_id"], "shift_time": lines[0]["departure_times"][0]})
    assert booking.status_code == 200
    code = client.post("/api/mobility/auth/request-code", json={"phone": "13800138000"}).json()["demo_code"]
    login = client.post("/api/mobility/auth/verify-code", json={"phone": "13800138000", "code": code})
    assert login.status_code == 200
    assert login.json()["masked_phone"] == "138****8000"
