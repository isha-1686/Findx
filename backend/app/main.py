"""FastAPI Application Entrypoint for AI Lost & Found Backend."""
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.db import init_db
from app.api.auth import router as auth_router
from app.api.reports import router as reports_router
from app.api.matching import router as matching_router
from app.api.ml import router as ml_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables
    init_db()
    # Ensure upload directory exists
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="AI-Based Lost and Found API",
    description=(
        "Backend for AI-powered lost and found platform. "
        "Matches lost and found reports using visual embeddings from a fine-tuned ResNet18 model "
        "and multimodal candidate ranking."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins + ["*"],  # Allow all during dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded item images directly
upload_dir = Path(settings.upload_dir)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

# Register API routes
app.include_router(auth_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(matching_router, prefix="/api/v1")
app.include_router(ml_router, prefix="/api/v1")


@app.get("/", tags=["Health"])
def root():
    return {
        "message": "AI Lost and Found Backend is active",
        "docs": "/docs",
        "version": "2.0.0",
    }


@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "healthy",
        "service": "ai-lost-and-found-api",
        "database": "sqlite-local",
    }
