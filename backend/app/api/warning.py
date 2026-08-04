from fastapi import APIRouter, Query
from app.services.warning_service import get_warnings

router = APIRouter(tags=["事件预警"])


@router.get("/warning/active")
def active_warnings(city: str = Query("beijing")):
    return {"items": get_warnings(city)}
