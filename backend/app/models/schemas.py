from typing import Literal

from pydantic import BaseModel, Field


class Coordinate(BaseModel):
    lng: float
    lat: float


class TrafficSegment(BaseModel):
    id: str
    name: str
    district: str
    coordinates: list[Coordinate]
    average_speed: float
    flow: int
    congestion_index: float
    congestion_level: str
    weather_factor: float
    event_factor: float


class TrafficEvent(BaseModel):
    id: str
    type: str
    title: str
    level: str
    district: str
    location: Coordinate
    description: str


class RouteOption(BaseModel):
    strategy: str
    title: str
    distance_km: float
    estimated_minutes: int
    congestion_score: float
    safety_score: float
    path: list[Coordinate]
    advice: str


class WhatIfSimulationRequest(BaseModel):
    city: str = "beijing"
    event_type: Literal["waterlog", "accident"]
    target_segment: str
    water_depth_cm: int | None = Field(default=None, ge=0, le=200)


class SimulationComparison(BaseModel):
    before_speed_kmh: float
    after_speed_kmh: float
    optimized_speed_kmh: float


class WhatIfSimulationData(BaseModel):
    affected_segments: list[str]
    spread_trend: list[float]
    comparison: SimulationComparison
    sop_actions: list[str]


class WhatIfSimulationResponse(BaseModel):
    code: int = 200
    data: WhatIfSimulationData


class CitizenSmartPlanRequest(BaseModel):
    city: str = "beijing"
    origin: str
    destination: str
    preference: Literal["fastest", "congestion_avoid", "safe_first"] = "safe_first"


class CitizenBusBookingRequest(BaseModel):
    city: str = "beijing"
    user_id: str = Field(min_length=1, max_length=64)
    shift_time: str
    line_id: str


class SmsCodeRequest(BaseModel):
    phone: str = Field(pattern=r"^1\d{10}$")


class SmsLoginRequest(SmsCodeRequest):
    code: str = Field(pattern=r"^\d{6}$")
