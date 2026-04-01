import os

# Full path to COLMAP executable (IMPORTANT for Windows)
COLMAP_PATH = r"C:\Program Files\colmap\bin\colmap.exe"

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_DIR = os.path.join(BASE_DIR, "data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
OUTPUT_DIR = os.path.join(DATA_DIR, "outputs")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ═══════════════════════════════════════════════════════════════════════════════
# RECONSTRUCTION QUALITY PRESETS
# These presets balance speed vs quality for different use cases
# ═══════════════════════════════════════════════════════════════════════════════

QUALITY_PRESETS = {
    "balanced": {
        "name": "Balanced",
        "description": "Good quality with reasonable processing time",
        "sift_max_image_size": 1200,
        "sift_max_num_features": 8192,
        "patch_match_max_image_size": 1200,
        "patch_match_geom_consistency": True,
        "stereo_fusion_min_num_pixels": 3,
        "mesh_depth": 9,
        "use_ball_pivoting": True,
        "estimated_time_multiplier": 1.0
    }
}

DEFAULT_QUALITY_PRESET = "balanced"


# ═══════════════════════════════════════════════════════════════════════════════
# ERROR MESSAGES (Human-readable diagnostics)
# ═══════════════════════════════════════════════════════════════════════════════

ERROR_MESSAGES = {
    "feature_extraction_failed": {
        "title": "Feature Extraction Failed",
        "message": "Could not detect features in the images.",
        "causes": [
            "Images may be too blurry",
            "Surfaces may lack texture",
            "Images may be too dark or overexposed"
        ],
        "suggestions": [
            "Ensure images are sharp and in focus",
            "Photograph textured surfaces (avoid plain walls, shiny objects)",
            "Use good, even lighting"
        ]
    },
    "matching_failed": {
        "title": "Feature Matching Failed", 
        "message": "Could not find enough matching features between images.",
        "causes": [
            "Images may not have enough overlap",
            "Viewpoints may be too different",
            "Scene may have changed between photos"
        ],
        "suggestions": [
            "Ensure 60-80% overlap between consecutive images",
            "Move camera smoothly around the object",
            "Avoid moving objects in the scene"
        ]
    },
    "sparse_reconstruction_failed": {
        "title": "Camera Pose Estimation Failed",
        "message": "Could not determine camera positions from the images.",
        "causes": [
            "Insufficient feature matches",
            "Images may be from disconnected viewpoints",
            "Camera intrinsics may vary too much"
        ],
        "suggestions": [
            "Capture images in a continuous sequence",
            "Use the same camera/phone for all images",
            "Add more intermediate viewpoints"
        ]
    },
    "dense_reconstruction_failed": {
        "title": "Dense Reconstruction Failed",
        "message": "Could not generate dense point cloud.",
        "causes": [
            "Not enough registered cameras",
            "Surfaces may be textureless or reflective",
            "GPU memory may be insufficient"
        ],
        "suggestions": [
            "Add more images with different viewpoints",
            "Avoid reflective or transparent surfaces",
            "Try reducing the number of images or re-taking photos"
        ]
    },
    "meshing_failed": {
        "title": "Mesh Generation Failed",
        "message": "Could not create 3D mesh from point cloud.",
        "causes": [
            "Point cloud may be too sparse",
            "Points may be too noisy",
            "Insufficient memory"
        ],
        "suggestions": [
            "Try with more/better quality images",
            "Try with fewer, higher-quality images",
            "Reduce number of images if memory is limited"
        ]
    },
    "unknown_error": {
        "title": "Reconstruction Failed",
        "message": "An unexpected error occurred during reconstruction.",
        "causes": [
            "System resource limitations",
            "Corrupted image files",
            "Software configuration issues"
        ],
        "suggestions": [
            "Try again with fewer images",
            "Ensure all images are valid JPEG/PNG files",
            "Check system resources (RAM, GPU)"
        ]
    }
}

