from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import citizen, cities, mobility, prediction, route, simulation, traffic, warning

app = FastAPI(title="智途云枢后端 API", description="面向多城市交通治理的多源数据融合与智能决策服务平台", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
for router in (cities.router, traffic.router, prediction.router, route.router, warning.router, simulation.router, citizen.router, mobility.router):
    app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {"name": "智途云枢", "scope": "multi-city", "docs": "/docs", "status": "running"}
