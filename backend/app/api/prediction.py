from fastapi import APIRouter, Query
from app.services.prediction_service import predict_congestion

router = APIRouter(tags=["拥堵预测"])


@router.get("/prediction/congestion")
def congestion_prediction(city: str = Query("beijing"), horizon_minutes: int = Query(60, ge=15, le=180)):
    return predict_congestion(city=city, horizon_minutes=horizon_minutes)
