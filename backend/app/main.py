from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.scenarios import router as scenarios_router
from backend.app.api.assets import router as assets_router
from backend.app.api.hazard import router as hazard_router
from backend.app.api.missions import router as missions_router
from backend.app.api.field import router as field_router
from backend.app.api.verification import router as verification_router
from backend.app.api.operational_map import router as operational_map_router
from .api.dispatch import router as dispatch_router


app = FastAPI(
    title="PralaySetu + Sankat OS",
    description="Cyclone Impact, Infrastructure Vulnerability and Response Management System",
    version="0.1.0"
)
# CORS: allow the deployed Vercel frontend and local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://pralaysetu-sankat-os.vercel.app",
        "https://pralaysetu-sankat-os-git-main-aditya8271s-projects.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://pralaysetu-sankat-os.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(scenarios_router, prefix="/api")
app.include_router(assets_router, prefix="/api")
app.include_router(hazard_router, prefix="/api")
app.include_router(missions_router, prefix="/api")
app.include_router(field_router, prefix="/api")
app.include_router(verification_router, prefix="/api")
app.include_router(operational_map_router, prefix="/api")
app.include_router(dispatch_router, prefix="/api")



@app.get("/")
def root():
    return {
        "project": "PralaySetu + Sankat OS",
        "status": "running"
    }


@app.get("/health")
def health():
    return {
        "status": "ok"
    }


