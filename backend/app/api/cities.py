from fastapi import APIRouter
from app.services.city_service import get_supported_cities

router = APIRouter(tags=["城市配置"])


@router.get("/cities")
def list_cities():
    return {"items": get_supported_cities()}
