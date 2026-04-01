"""
═══════════════════════════════════════════════════════════════════════════════
COLMAP PIPELINE RUNNER
Automated SfM + MVS pipeline with quality presets and error handling
═══════════════════════════════════════════════════════════════════════════════
"""

import os
import subprocess
from backend.config import (
    COLMAP_PATH, UPLOAD_DIR, OUTPUT_DIR, 
    QUALITY_PRESETS, DEFAULT_QUALITY_PRESET, ERROR_MESSAGES
)
from backend.postprocess import generate_mesh_and_glb


class ReconstructionError(Exception):
    """Custom exception with structured error information."""
    def __init__(self, error_type: str, original_error: str = None):
        self.error_type = error_type
        self.original_error = original_error
        self.error_info = ERROR_MESSAGES.get(error_type, ERROR_MESSAGES["unknown_error"])
        
        message = f"{self.error_info['title']}: {self.error_info['message']}"
        if original_error:
            message += f" (Details: {original_error})"
        
        super().__init__(message)
    
    def to_dict(self):
        return {
            "error_type": self.error_type,
            "title": self.error_info["title"],
            "message": self.error_info["message"],
            "causes": self.error_info["causes"],
            "suggestions": self.error_info["suggestions"],
            "original_error": self.original_error
        }


def run_colmap(job_id: str, quality: str = None, status_callback=None):
    """
    Run the complete COLMAP pipeline with progress reporting and quality presets.
    
    Args:
        job_id: Unique job identifier
        quality: Quality preset name (currently only "balanced")
        status_callback: Optional callback function to report stage progress
    
    Raises:
        ReconstructionError: If any stage fails, with structured error info
    """
    # Get quality preset
    preset_name = quality or DEFAULT_QUALITY_PRESET
    if preset_name not in QUALITY_PRESETS:
        preset_name = DEFAULT_QUALITY_PRESET
    preset = QUALITY_PRESETS[preset_name]
    
    def report_stage(stage):
        if status_callback:
            status_callback(stage)
        print(f"[COLMAP] Stage: {stage} (Quality: {preset_name})")
    
    image_dir = os.path.join(UPLOAD_DIR, job_id)
    workspace = os.path.join(OUTPUT_DIR, job_id)

    database_path = os.path.join(workspace, "database.db")
    sparse_dir = os.path.join(workspace, "sparse")
    dense_dir = os.path.join(workspace, "dense")

    os.makedirs(sparse_dir, exist_ok=True)
    os.makedirs(dense_dir, exist_ok=True)

    # ══════════════════════════════════════════════════════════════════════════
    # SPARSE RECONSTRUCTION (Structure from Motion)
    # ══════════════════════════════════════════════════════════════════════════

    # Stage 1: Feature Extraction
    report_stage("feature_extraction")
    try:
        result = subprocess.run([
            COLMAP_PATH, "feature_extractor",
            "--database_path", database_path,
            "--image_path", image_dir,
            "--ImageReader.single_camera", "1",
            "--SiftExtraction.max_image_size", str(preset["sift_max_image_size"]),
            "--SiftExtraction.max_num_features", str(preset["sift_max_num_features"])
        ], check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        raise ReconstructionError("feature_extraction_failed", e.stderr or str(e))

    # Stage 2: Feature Matching
    report_stage("feature_matching")
    try:
        result = subprocess.run([
            COLMAP_PATH, "exhaustive_matcher",
            "--database_path", database_path,
            "--SiftMatching.guided_matching", "1"
        ], check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        raise ReconstructionError("matching_failed", e.stderr or str(e))

    # Stage 3: Sparse Reconstruction (SfM)
    report_stage("sparse_reconstruction")
    try:
        result = subprocess.run([
            COLMAP_PATH, "mapper",
            "--database_path", database_path,
            "--image_path", image_dir,
            "--output_path", sparse_dir
        ], check=True, capture_output=True, text=True)
        
        # Verify sparse reconstruction succeeded
        sparse_model_path = os.path.join(sparse_dir, "0")
        if not os.path.exists(sparse_model_path):
            raise ReconstructionError("sparse_reconstruction_failed", 
                                      "No sparse model produced - insufficient matches")
    except subprocess.CalledProcessError as e:
        raise ReconstructionError("sparse_reconstruction_failed", e.stderr or str(e))

    # ══════════════════════════════════════════════════════════════════════════
    # DENSE RECONSTRUCTION (Multi-View Stereo)
    # ══════════════════════════════════════════════════════════════════════════

    report_stage("dense_reconstruction")
    
    # Undistort images
    try:
        subprocess.run([
            COLMAP_PATH, "image_undistorter",
            "--image_path", image_dir,
            "--input_path", os.path.join(sparse_dir, "0"),
            "--output_path", dense_dir,
            "--output_type", "COLMAP"
        ], check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        raise ReconstructionError("dense_reconstruction_failed", f"Image undistortion failed: {e.stderr or str(e)}")

    # PatchMatch stereo
    try:
        geom_consistency = "true" if preset["patch_match_geom_consistency"] else "false"
        subprocess.run([
            COLMAP_PATH, "patch_match_stereo",
            "--workspace_path", dense_dir,
            "--PatchMatchStereo.max_image_size", str(preset["patch_match_max_image_size"]),
            "--PatchMatchStereo.geom_consistency", geom_consistency
        ], check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        raise ReconstructionError("dense_reconstruction_failed", f"PatchMatch stereo failed: {e.stderr or str(e)}")

    # Stereo fusion (creates dense point cloud)
    try:
        subprocess.run([
            COLMAP_PATH, "stereo_fusion",
            "--workspace_path", dense_dir,
            "--output_path", os.path.join(dense_dir, "fused.ply"),
            "--StereoFusion.min_num_pixels", str(preset["stereo_fusion_min_num_pixels"])
        ], check=True, capture_output=True, text=True)
        
        # Verify point cloud was created
        fused_path = os.path.join(dense_dir, "fused.ply")
        if not os.path.exists(fused_path):
            raise ReconstructionError("dense_reconstruction_failed", "No point cloud produced")
        
        # Check point cloud isn't empty (file should be > 1KB)
        if os.path.getsize(fused_path) < 1024:
            raise ReconstructionError("dense_reconstruction_failed", "Point cloud is too sparse")
            
    except subprocess.CalledProcessError as e:
        raise ReconstructionError("dense_reconstruction_failed", f"Stereo fusion failed: {e.stderr or str(e)}")

    # ══════════════════════════════════════════════════════════════════════════
    # MESH GENERATION
    # ══════════════════════════════════════════════════════════════════════════
    
    report_stage("meshing")
    try:
        generate_mesh_and_glb(
            dense_dir, 
            use_ball_pivoting=preset["use_ball_pivoting"],
            poisson_depth=preset["mesh_depth"]
        )
    except Exception as e:
        raise ReconstructionError("meshing_failed", str(e))

    return True


def get_quality_presets():
    """Return available quality presets for the frontend."""
    return {
        name: {
            "name": preset["name"],
            "description": preset["description"],
            "estimated_time_multiplier": preset["estimated_time_multiplier"]
        }
        for name, preset in QUALITY_PRESETS.items()
    }
