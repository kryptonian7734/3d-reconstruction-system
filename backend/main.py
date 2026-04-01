from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Query, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
import uuid
import os
import shutil
import json
from threading import Lock
from datetime import datetime
from typing import Optional

from backend.colmap_runner import run_colmap, get_quality_presets, ReconstructionError
from backend.config import UPLOAD_DIR, OUTPUT_DIR, QUALITY_PRESETS, DEFAULT_QUALITY_PRESET

app = FastAPI(
    title="3D Reconstruction System",
    description="Automated photogrammetry pipeline using COLMAP",
    version="2.0.0"
)

MAX_UPLOAD_IMAGES = 50


# Job status tracking
STATUS_FILE = os.path.join(OUTPUT_DIR, "job_status.json")
status_lock = Lock()

def set_job_status(job_id, status, stage=None, error=None, metadata=None):
    """
    Set job status with optional stage information for granular progress tracking.
    
    Stages: uploaded, feature_extraction, feature_matching, 
            sparse_reconstruction, dense_reconstruction, meshing, finished
    """
    with status_lock:
        if os.path.exists(STATUS_FILE):
            with open(STATUS_FILE, "r") as f:
                data = json.load(f)
        else:
            data = {}
        
        job_data = {"status": status, "updated_at": datetime.now().isoformat()}
        
        if stage:
            job_data["stage"] = stage
        if error:
            job_data["error"] = error
        if metadata:
            job_data["metadata"] = metadata
            
        # Preserve existing metadata if not overwriting
        if job_id in data and "metadata" in data[job_id] and not metadata:
            job_data["metadata"] = data[job_id]["metadata"]
            
        data[job_id] = job_data
        
        with open(STATUS_FILE, "w") as f:
            json.dump(data, f, indent=2)

def get_job_status(job_id):
    with status_lock:
        if not os.path.exists(STATUS_FILE):
            return {"status": "unknown"}
        with open(STATUS_FILE, "r") as f:
            data = json.load(f)
        return data.get(job_id, {"status": "unknown"})

# -------------------------------------------------
# PATH SETUP
# -------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

STATIC_DIR = os.path.join(BASE_DIR, "backend", "static")

# -------------------------------------------------
# SERVE FRONTEND
# -------------------------------------------------
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def serve_frontend():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

# -------------------------------------------------
# API ENDPOINTS
# -------------------------------------------------

@app.post("/upload")
async def upload_images(
    background_tasks: BackgroundTasks, 
    files: list[UploadFile] = File(...),
    quality: Optional[str] = Form(default=DEFAULT_QUALITY_PRESET)
):
    """
    Upload images and start reconstruction.
    
    Args:
        files: List of image files to upload
        quality: Quality preset (currently only "balanced" is supported)
    """
    job_id = str(uuid.uuid4())
    job_path = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(job_path, exist_ok=True)

    # Always use balanced preset (only preset available)
    quality = DEFAULT_QUALITY_PRESET

    target_max_size = 1200  # Max dimension while preserving aspect ratio
    saved_count = 0
    
    for i, file in enumerate(files):
        if i >= MAX_UPLOAD_IMAGES:
            break
        img_path = os.path.join(job_path, file.filename)
        with open(img_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # Resize while preserving aspect ratio (no aggressive cropping)
        try:
            img = Image.open(img_path).convert('RGB')
            
            # Calculate new size preserving aspect ratio
            width, height = img.size
            max_dim = max(width, height)
            
            if max_dim > target_max_size:
                ratio = target_max_size / max_dim
                new_width = int(width * ratio)
                new_height = int(height * ratio)
                img = img.resize((new_width, new_height), Image.LANCZOS)
            
            img.save(img_path, quality=95)
            saved_count += 1
        except Exception as e:
            print(f"[WARN] Could not process image {img_path}: {e}")

    set_job_status(job_id, "uploaded", stage="uploaded", metadata={
        "image_count": saved_count,
        "quality_preset": quality,
        "started_at": datetime.now().isoformat()
    })
    
    # Start reconstruction in background
    background_tasks.add_task(run_reconstruction, job_id, quality)
    return {"job_id": job_id, "image_count": saved_count, "quality": quality}

def run_reconstruction(job_id, quality="balanced"):
    """Background task to run the reconstruction pipeline."""
    set_job_status(job_id, "processing", stage="feature_extraction")
    try:
        run_colmap(
            job_id, 
            quality=quality,
            status_callback=lambda stage: set_job_status(job_id, "processing", stage=stage)
        )
        set_job_status(job_id, "finished", stage="finished", metadata={
            "completed_at": datetime.now().isoformat()
        })
    except ReconstructionError as e:
        # Structured error with helpful information
        set_job_status(job_id, "error", error=e.to_dict())
    except Exception as e:
        # Generic error fallback
        set_job_status(job_id, "error", error={
            "error_type": "unknown_error",
            "title": "Reconstruction Failed",
            "message": str(e),
            "causes": ["An unexpected error occurred"],
            "suggestions": ["Try again with different images", "Check system resources"]
        })


# -------------------------------------------------
# IMAGE ANALYSIS ENDPOINT
# -------------------------------------------------
@app.get("/analyze/{job_id}")
def analyze_images(job_id: str):
    """
    Analyze uploaded images for quality and predict reconstruction success.
    
    Returns blur detection, feature counts, and recommendations.
    """
    try:
        from backend.image_analyzer import analyze_images as run_analysis
        
        image_dir = os.path.join(UPLOAD_DIR, job_id)
        if not os.path.exists(image_dir):
            return JSONResponse(
                status_code=404,
                content={"error": "Job not found", "job_id": job_id}
            )
        
        analysis = run_analysis(image_dir)
        return analysis
        
    except ImportError:
        return JSONResponse(
            status_code=500,
            content={"error": "Image analyzer not available. Install opencv-python."}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Analysis failed: {str(e)}"}
        )


# -------------------------------------------------
# QUALITY PRESETS ENDPOINT
# -------------------------------------------------
@app.get("/presets")
def get_presets():
    """Get available quality presets for reconstruction."""
    return get_quality_presets()


@app.get("/model/{job_id}")
def get_model(job_id: str):
    model_path = os.path.join(
        OUTPUT_DIR, job_id, "dense", "model.glb"
    )
    if not os.path.exists(model_path):
        return {"error": "model.glb not found"}
    return FileResponse(model_path, media_type="model/gltf-binary")


# New: job status endpoint
@app.get("/status/{job_id}")
def job_status(job_id: str):
    """Get detailed job status including current stage and metadata."""
    status = get_job_status(job_id)
    return status


# New: Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "3D Reconstruction System"}
