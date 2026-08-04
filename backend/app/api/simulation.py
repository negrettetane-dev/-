from fastapi import APIRouter

from app.models.schemas import WhatIfSimulationRequest, WhatIfSimulationResponse
from app.services.simulation_service import run_what_if_simulation

router = APIRouter(tags=["沙盘推演"])


@router.post("/simulation/what-if", response_model=WhatIfSimulationResponse)
def what_if_simulation(request: WhatIfSimulationRequest):
    return run_what_if_simulation(request)
