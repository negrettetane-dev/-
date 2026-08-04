from fastapi import HTTPException
from app.core.config import CITY_CONFIG
from app.services.sample_data import POIS


def ensure_city(city: str) -> None:
    if city not in CITY_CONFIG:
        raise HTTPException(status_code=404, detail=f"暂不支持城市：{city}")


def get_supported_cities():
    return [
        {
            "code": code,
            **config,
            "pois": [{"id": poi_id, **poi} for poi_id, poi in POIS.get(code, {}).items()],
        }
        for code, config in CITY_CONFIG.items()
    ]
