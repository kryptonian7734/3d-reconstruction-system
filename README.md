# 3D Reconstruction System

## Overview
This project is an automated 3D Reconstruction System that converts multiple 2D photos into an interactive 3D model using an advanced photogrammetry pipeline. You can upload images of an object from different angles, and the system reconstructs a 3D model that you can view and interact with directly in your browser.

## Features
- Upload up to 50 images to generate a 3D model.
- Robust photogrammetry pipeline using COLMAP and Open3D.
- Interactive 3D web viewer using Three.js (React/Vanilla JS).
- Background job processing and status tracking.
- Preprocessing and image quality analysis capabilities.

## Technology Stack
**Backend**:
- **FastAPI**: API server and job orchestration.
- **COLMAP**: Core photogrammetry engine (external executable).
- **Open3D**: Point cloud to mesh conversion and GLB export.
- **Pillow**: Image loading, resizing, and preprocessing.
- **OpenCV & NumPy**: Image quality analysis.

**Frontend**:
- **React**: Modern web application interface (in `frontend/src`).
- **Vanilla JS**: Fallback UI (served from `backend/static`).
- **Three.js**: 3D model viewer running directly in the browser.

## Workflow Pipeline
1. **Upload**: Users upload 2D images (up to 50) via the frontend. The project uses the highly reliable "Balanced" quality preset.
2. **Job Creation**: The backend generates a unique Job ID, stores the images, and resizes them while maintaining aspect ratios.
3. **Reconstruction (Background)**:
   - *Feature Extraction*
   - *Feature Matching*
   - *Sparse Reconstruction*
   - *Dense Reconstruction*
   - *Meshing & Post-processing*
4. **Export**: Open3D processes the dense point cloud and exports a `.glb` 3D model.
5. **Viewing**: The frontend continuously polls the status and subsequently loads the `.glb` model into the Three.js viewer upon completion.

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js and npm (for the React Frontend)
- COLMAP installed and added to your system PATH.

### Backend Setup
1. Create a virtual environment:
   ```bash
   python -m venv venv
   # On Windows: venv\Scripts\activate
   # On macOS/Linux: source venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the backend server:
   ```bash
   uvicorn backend.main:app --reload
   ```

### Frontend Setup
1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the React development server:
   ```bash
   npm start
   ```

## Directory Structure
- `backend/`: FastAPI application, job queue, and COLMAP runner scripts.
- `frontend/`: React application and Three.js viewer.
- `data/`: Temporary storage for user uploads and generated `.glb` models.
- `Project_Workflow.txt`: Detailed internal documentation of the end-to-end pipeline.

## License
MIT
