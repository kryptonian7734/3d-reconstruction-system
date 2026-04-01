/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 3D RECONSTRUCTION SYSTEM - Main Application Logic
 * Vanilla JavaScript with ES Modules
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATION STATE
// ─────────────────────────────────────────────────────────────────────────────
const AppState = {
    IDLE: 'idle',
    IMAGES_UPLOADED: 'images_uploaded',
    RECONSTRUCTION_RUNNING: 'reconstruction_running',
    MODEL_READY: 'model_ready',
    ERROR: 'error'
};

const app = {
    state: AppState.IDLE,
    selectedFiles: [],
    jobId: null,
    startTime: null,
    pollingInterval: null,
    viewer: null
};

// ─────────────────────────────────────────────────────────────────────────────
// DOM ELEMENTS
// ─────────────────────────────────────────────────────────────────────────────
const elements = {
    // Workflow
    workflowStatus: document.getElementById('workflowStatus'),
    
    // Upload Panel
    uploadPanel: document.getElementById('uploadPanel'),
    uploadZone: document.getElementById('uploadZone'),
    fileInput: document.getElementById('fileInput'),
    previewGrid: document.getElementById('previewGrid'),
    imageCount: document.getElementById('imageCount'),
    clearImagesBtn: document.getElementById('clearImagesBtn'),
    uploadBtn: document.getElementById('uploadBtn'),
    
    // Analysis
    analysisResults: document.getElementById('analysisResults'),
    analysisBadge: document.getElementById('analysisBadge'),
    analysisContent: document.getElementById('analysisContent'),
    
    // Reconstruction Panel
    reconstructionPanel: document.getElementById('reconstructionPanel'),
    jobIdDisplay: document.getElementById('jobIdDisplay'),
    progressFill: document.getElementById('progressFill'),
    progressPercentage: document.getElementById('progressPercentage'),
    stageList: document.getElementById('stageList'),
    currentStageDisplay: document.getElementById('currentStageDisplay'),
    
    // Error Panel
    errorPanel: document.getElementById('errorPanel'),
    errorTitle: document.getElementById('errorTitle'),
    errorMessage: document.getElementById('errorMessage'),
    errorCausesList: document.getElementById('errorCausesList'),
    errorSuggestionsList: document.getElementById('errorSuggestionsList'),
    retryBtn: document.getElementById('retryBtn'),
    
    // Viewer Panel
    viewerPanel: document.getElementById('viewerPanel'),
    viewerCanvas: document.getElementById('viewerCanvas'),
    viewerLoading: document.getElementById('viewerLoading'),
    resetCameraBtn: document.getElementById('resetCameraBtn'),
    screenshotBtn: document.getElementById('screenshotBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    newReconstructionBtn: document.getElementById('newReconstructionBtn'),
    
    // Stats
    statImages: document.getElementById('statImages'),
    statVertices: document.getElementById('statVertices'),
    statFaces: document.getElementById('statFaces'),
    statTime: document.getElementById('statTime')
};

// ─────────────────────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
function setState(newState) {
    app.state = newState;
    updateUI();
    updateWorkflowIndicator();
}

function updateUI() {
    // Hide all panels
    elements.uploadPanel.classList.add('hidden');
    elements.reconstructionPanel.classList.add('hidden');
    elements.errorPanel.classList.add('hidden');
    elements.viewerPanel.classList.add('hidden');
    
    // Show appropriate panel based on state
    switch (app.state) {
        case AppState.IDLE:
        case AppState.IMAGES_UPLOADED:
            elements.uploadPanel.classList.remove('hidden');
            break;
        case AppState.RECONSTRUCTION_RUNNING:
            elements.reconstructionPanel.classList.remove('hidden');
            break;
        case AppState.MODEL_READY:
            elements.viewerPanel.classList.remove('hidden');
            break;
        case AppState.ERROR:
            elements.errorPanel.classList.remove('hidden');
            break;
    }
}

function updateWorkflowIndicator() {
    const steps = elements.workflowStatus.querySelectorAll('.status-step');
    const stateOrder = [AppState.IDLE, AppState.IMAGES_UPLOADED, AppState.RECONSTRUCTION_RUNNING, AppState.MODEL_READY];
    const currentIndex = stateOrder.indexOf(app.state);
    
    steps.forEach((step, index) => {
        step.classList.remove('active', 'completed');
        
        if (app.state === AppState.ERROR) {
            // On error, mark current step as active (where it failed)
            if (index === currentIndex || (currentIndex === -1 && index === 2)) {
                step.classList.add('active');
            } else if (index < currentIndex || (currentIndex === -1 && index < 2)) {
                step.classList.add('completed');
            }
        } else {
            if (index < currentIndex) {
                step.classList.add('completed');
            } else if (index === currentIndex) {
                step.classList.add('active');
            }
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE UPLOAD HANDLING
// ─────────────────────────────────────────────────────────────────────────────
function initUploadHandlers() {
    // Drag and drop
    elements.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.add('drag-over');
    });
    
    elements.uploadZone.addEventListener('dragleave', () => {
        elements.uploadZone.classList.remove('drag-over');
    });
    
    elements.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });
    
    // Click to browse
    elements.uploadZone.addEventListener('click', () => {
        elements.fileInput.click();
    });
    
    elements.fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
    
    // Clear button
    elements.clearImagesBtn.addEventListener('click', clearFiles);
    
    // Upload button
    elements.uploadBtn.addEventListener('click', uploadFiles);
}

function handleFiles(files) {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    // Limit to 50 images
    const maxImages = 50;
    const newFiles = imageFiles.slice(0, maxImages - app.selectedFiles.length);
    
    app.selectedFiles = [...app.selectedFiles, ...newFiles].slice(0, maxImages);
    
    updateImagePreviews();
    updateButtonStates();
}

function updateImagePreviews() {
    elements.previewGrid.innerHTML = '';
    
    app.selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `
                <img src="${e.target.result}" alt="${file.name}">
                <button class="remove-btn" data-index="${index}" title="Remove">×</button>
            `;
            elements.previewGrid.appendChild(div);
            
            // Add remove handler
            div.querySelector('.remove-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                removeFile(index);
            });
        };
        reader.readAsDataURL(file);
    });
    
    elements.imageCount.textContent = `${app.selectedFiles.length} image${app.selectedFiles.length !== 1 ? 's' : ''} selected`;
}

function removeFile(index) {
    app.selectedFiles.splice(index, 1);
    updateImagePreviews();
    updateButtonStates();
}

function clearFiles() {
    app.selectedFiles = [];
    elements.fileInput.value = '';
    updateImagePreviews();
    updateButtonStates();
    
    // Hide analysis results
    if (elements.analysisResults) {
        elements.analysisResults.classList.add('hidden');
    }
}

function updateButtonStates() {
    const hasFiles = app.selectedFiles.length > 0;
    elements.clearImagesBtn.disabled = !hasFiles;
    elements.uploadBtn.disabled = app.selectedFiles.length < 3; // Need at least 3 images
}


// ─────────────────────────────────────────────────────────────────────────────
// IMAGE ANALYSIS (Pre-reconstruction quality check)
// ─────────────────────────────────────────────────────────────────────────────
async function analyzeImages(jobId) {
    if (!elements.analysisResults) return;
    
    elements.analysisResults.classList.remove('hidden');
    elements.analysisBadge.textContent = 'Analyzing...';
    elements.analysisBadge.className = 'analysis-badge';
    elements.analysisContent.innerHTML = '<div class="spinner"></div> Checking image quality...';
    
    try {
        const response = await fetch(`/analyze/${jobId}`);
        if (!response.ok) {
            throw new Error('Analysis not available');
        }
        
        const analysis = await response.json();
        displayAnalysisResults(analysis);
    } catch (error) {
        console.log('Analysis not available:', error);
        elements.analysisResults.classList.add('hidden');
    }
}

function displayAnalysisResults(analysis) {
    // Update badge
    elements.analysisBadge.textContent = analysis.overall_rating.toUpperCase();
    elements.analysisBadge.className = `analysis-badge ${analysis.overall_rating}`;
    
    // Build content HTML
    let html = `
        <div class="analysis-stats">
            <div class="analysis-stat">
                <div class="analysis-stat-value">${analysis.total_images}</div>
                <div class="analysis-stat-label">Images</div>
            </div>
            <div class="analysis-stat">
                <div class="analysis-stat-value">${analysis.good_images}</div>
                <div class="analysis-stat-label">Good Quality</div>
            </div>
            <div class="analysis-stat">
                <div class="analysis-stat-value">${analysis.blurry_count}</div>
                <div class="analysis-stat-label">Blurry</div>
            </div>
            <div class="analysis-stat">
                <div class="analysis-stat-value">${analysis.success_probability}</div>
                <div class="analysis-stat-label">Success Rate</div>
            </div>
        </div>
    `;
    
    // Add warnings
    if (analysis.warnings && analysis.warnings.length > 0) {
        html += `
            <div class="analysis-recommendations warnings">
                <h4>⚠️ Warnings</h4>
                <ul>
                    ${analysis.warnings.map(w => `<li>${w}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    // Add recommendations
    if (analysis.recommendations && analysis.recommendations.length > 0) {
        html += `
            <div class="analysis-recommendations tips">
                <h4>💡 Recommendations</h4>
                <ul>
                    ${analysis.recommendations.map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    elements.analysisContent.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────────────
// API COMMUNICATION
// ─────────────────────────────────────────────────────────────────────────────
async function uploadFiles() {
    if (app.selectedFiles.length < 3) {
        alert('Please select at least 3 images for reconstruction.');
        return;
    }
    
    const formData = new FormData();
    app.selectedFiles.forEach(file => {
        formData.append('files', file);
    });
    
    // Quality is always balanced (only preset available)
    formData.append('quality', 'balanced');
    
    try {
        elements.uploadBtn.disabled = true;
        elements.uploadBtn.innerHTML = `
            <div class="spinner"></div>
            Uploading...
        `;
        
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        app.jobId = data.job_id;
        app.startTime = Date.now();
        
        // Update UI
        elements.jobIdDisplay.textContent = `Job ID: ${app.jobId}`;
        elements.statImages.textContent = app.selectedFiles.length;
        
        setState(AppState.RECONSTRUCTION_RUNNING);
        startPolling();
        
    } catch (error) {
        console.error('Upload error:', error);
        showError({
            title: 'Upload Failed',
            message: error.message,
            causes: ['Network connection issue', 'Server may be unavailable'],
            suggestions: ['Check your internet connection', 'Try again in a moment']
        });
    }
}

function startPolling() {
    // Reset progress UI
    updateProgress(0, 'uploaded');
    
    app.pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`/status/${app.jobId}`);
            const data = await response.json();
            
            handleStatusUpdate(data);
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 2000); // Poll every 2 seconds
}

function stopPolling() {
    if (app.pollingInterval) {
        clearInterval(app.pollingInterval);
        app.pollingInterval = null;
    }
}

function handleStatusUpdate(data) {
    const status = data.status;
    const stage = data.stage;
    
    // Use actual stage from backend if available
    if (status === 'processing' && stage) {
        // Calculate progress based on stage
        const stageProgress = {
            'uploaded': 5,
            'feature_extraction': 15,
            'feature_matching': 35,
            'sparse_reconstruction': 55,
            'dense_reconstruction': 75,
            'meshing': 90
        };
        
        const percent = stageProgress[stage] || 50;
        updateProgress(percent, stage);
    } else if (status === 'finished') {
        updateProgress(100, 'finished');
        stopPolling();
        
        // Calculate processing time
        const totalTime = Date.now() - app.startTime;
        elements.statTime.textContent = formatDuration(totalTime);
        
        // Transition to viewer
        setTimeout(() => {
            setState(AppState.MODEL_READY);
            initViewer();
        }, 1000);
    } else if (status === 'error') {
        stopPolling();
        // Handle structured error
        const error = data.error;
        if (typeof error === 'object') {
            showError(error);
        } else {
            showError({
                title: 'Reconstruction Failed',
                message: error || 'An unknown error occurred',
                causes: ['Check the server logs for details'],
                suggestions: ['Try with different images']
            });
        }
    } else if (status === 'uploaded') {
        updateProgress(5, 'uploaded');
    }
}

function updateProgress(percent, stage) {
    elements.progressFill.style.width = `${percent}%`;
    elements.progressPercentage.textContent = `${Math.round(percent)}%`;
    
    // Update stage indicators
    const stages = ['uploaded', 'feature_extraction', 'feature_matching', 
                    'sparse_reconstruction', 'dense_reconstruction', 'meshing'];
    const currentIndex = stages.indexOf(stage);
    
    stages.forEach((s, index) => {
        const stageEl = document.querySelector(`.stage[data-stage="${s}"]`);
        if (stageEl) {
            const icon = stageEl.querySelector('.stage-icon');
            stageEl.classList.remove('active', 'completed');
            icon.classList.remove('active', 'completed', 'pending');
            
            if (index < currentIndex) {
                stageEl.classList.add('completed');
                icon.classList.add('completed');
            } else if (index === currentIndex) {
                stageEl.classList.add('active');
                icon.classList.add('active');
            } else {
                icon.classList.add('pending');
            }
        }
    });
    
    // Update current stage display
    const stageNames = {
        'uploaded': 'Preparing workspace...',
        'feature_extraction': 'Extracting SIFT features from images...',
        'feature_matching': 'Matching features between image pairs...',
        'sparse_reconstruction': 'Computing camera poses (Structure from Motion)...',
        'dense_reconstruction': 'Generating dense point cloud (Multi-View Stereo)...',
        'meshing': 'Creating triangle mesh from point cloud...',
        'finished': 'Reconstruction complete!'
    };
    
    const displayText = stageNames[stage] || 'Processing...';
    elements.currentStageDisplay.innerHTML = stage === 'finished' 
        ? `<span style="color: var(--color-success);">✓ ${displayText}</span>`
        : `<div class="spinner"></div><span>${displayText}</span>`;
}

function showError(errorData) {
    // Handle both string and object error formats
    if (typeof errorData === 'string') {
        errorData = {
            title: 'Reconstruction Failed',
            message: errorData,
            causes: ['Check the logs for more details'],
            suggestions: ['Try with different images']
        };
    }
    
    // Update error panel with structured information
    if (elements.errorTitle) {
        elements.errorTitle.textContent = errorData.title || 'Reconstruction Failed';
    }
    elements.errorMessage.textContent = errorData.message || 'An unknown error occurred.';
    
    // Populate causes
    if (elements.errorCausesList && errorData.causes) {
        elements.errorCausesList.innerHTML = '';
        errorData.causes.forEach(cause => {
            const li = document.createElement('li');
            li.textContent = cause;
            elements.errorCausesList.appendChild(li);
        });
    }
    
    // Populate suggestions
    if (elements.errorSuggestionsList && errorData.suggestions) {
        elements.errorSuggestionsList.innerHTML = '';
        errorData.suggestions.forEach(suggestion => {
            const li = document.createElement('li');
            li.textContent = suggestion;
            elements.errorSuggestionsList.appendChild(li);
        });
    }
    
    setState(AppState.ERROR);
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// THREE.JS VIEWER (COLMAP-Quality Rendering)
// ─────────────────────────────────────────────────────────────────────────────
function initViewer() {
    elements.viewerLoading.classList.remove('hidden');
    
    const container = elements.viewerCanvas;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Scene with gradient background (like COLMAP)
    const scene = new THREE.Scene();
    
    // Create gradient background
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#334155');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    const backgroundTexture = new THREE.CanvasTexture(canvas);
    scene.background = backgroundTexture;
    
    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 10000);
    camera.position.set(0, 0, 10);
    
    // High-quality renderer
    const renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        preserveDrawingBuffer: true,
        alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    
    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.minDistance = 0.5;
    controls.maxDistance = 100;
    
    // COLMAP-style lighting (soft, even illumination)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Key light (main)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(5, 10, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    scene.add(keyLight);
    
    // Fill light (softer, from opposite side)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
    
    // Rim light (back light for definition)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, -5, -10);
    scene.add(rimLight);
    
    // Add hemisphere light for natural sky/ground color
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.3);
    scene.add(hemiLight);
    
    // Store viewer reference
    app.viewer = {
        scene,
        camera,
        renderer,
        controls,
        model: null,
        initialCameraPosition: camera.position.clone(),
        initialControlsTarget: controls.target.clone()
    };
    
    // Load model
    const loader = new GLTFLoader();
    loader.load(
        `/model/${app.jobId}`,
        (gltf) => {
            const model = gltf.scene;
            
            // Process materials for COLMAP-like appearance
            let totalVertices = 0;
            let totalFaces = 0;
            
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    // Count geometry
                    if (child.geometry) {
                        const geo = child.geometry;
                        totalVertices += geo.attributes.position ? geo.attributes.position.count : 0;
                        totalFaces += geo.index ? geo.index.count / 3 : 
                                     (geo.attributes.position ? geo.attributes.position.count / 3 : 0);
                    }
                    
                    // Enhance material for better appearance
                    if (child.material) {
                        // Use MeshStandardMaterial for PBR rendering
                        if (child.material.isMeshBasicMaterial || !child.material.isMeshStandardMaterial) {
                            const oldMat = child.material;
                            child.material = new THREE.MeshStandardMaterial({
                                vertexColors: true,
                                side: THREE.DoubleSide,
                                roughness: 0.8,
                                metalness: 0.1,
                                flatShading: false
                            });
                            if (oldMat.map) child.material.map = oldMat.map;
                        } else {
                            child.material.vertexColors = true;
                            child.material.side = THREE.DoubleSide;
                            child.material.roughness = 0.8;
                            child.material.metalness = 0.1;
                        }
                        child.material.needsUpdate = true;
                    }
                }
            });
            
            // Center and scale model
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            model.position.sub(center);
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 5 / maxDim;
            model.scale.setScalar(scale);
            
            scene.add(model);
            app.viewer.model = model;
            
            // Optimal camera position
            const distance = maxDim * scale * 2;
            camera.position.set(distance * 0.7, distance * 0.5, distance * 0.7);
            controls.target.set(0, 0, 0);
            controls.update();
            
            // Update stats
            elements.statVertices.textContent = formatNumber(totalVertices);
            elements.statFaces.textContent = formatNumber(totalFaces);
            
            // Store initial camera position
            app.viewer.initialCameraPosition = camera.position.clone();
            app.viewer.initialControlsTarget = controls.target.clone();
            
            elements.viewerLoading.classList.add('hidden');
        },
        (progress) => {
            const percent = progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0;
            console.log(`Loading: ${percent.toFixed(1)}%`);
        },
        (error) => {
            console.error('Model loading error:', error);
            elements.viewerLoading.innerHTML = `
                <span style="color: var(--color-error);">Failed to load 3D model</span>
            `;
        }
    );
    
    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    
    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
    resizeObserver.observe(container);
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEWER CONTROLS
// ─────────────────────────────────────────────────────────────────────────────
function initViewerControls() {
    // Reset camera
    elements.resetCameraBtn.addEventListener('click', () => {
        if (app.viewer) {
            app.viewer.camera.position.copy(app.viewer.initialCameraPosition);
            app.viewer.controls.target.copy(app.viewer.initialControlsTarget);
            app.viewer.controls.update();
        }
    });
    
    // Screenshot
    elements.screenshotBtn.addEventListener('click', () => {
        if (app.viewer) {
            const canvas = app.viewer.renderer.domElement;
            const link = document.createElement('a');
            link.download = `3d-model-${app.jobId}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    });
    
    // Fullscreen
    elements.fullscreenBtn.addEventListener('click', () => {
        const container = elements.viewerCanvas;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen();
        }
    });
    
    // New reconstruction
    elements.newReconstructionBtn.addEventListener('click', resetApp);
    
    // Retry button
    elements.retryBtn.addEventListener('click', resetApp);
}

function resetApp() {
    stopPolling();
    
    // Cleanup viewer
    if (app.viewer) {
        if (app.viewer.renderer) {
            app.viewer.renderer.dispose();
            if (app.viewer.renderer.domElement.parentNode) {
                app.viewer.renderer.domElement.parentNode.removeChild(app.viewer.renderer.domElement);
            }
        }
        app.viewer = null;
    }
    
    // Reset state
    app.jobId = null;
    app.startTime = null;
    clearFiles();
    
    // Reset progress UI
    elements.progressFill.style.width = '0%';
    elements.progressPercentage.textContent = '0%';
    elements.currentStageDisplay.innerHTML = `
        <div class="spinner"></div>
        <span>Initializing...</span>
    `;
    
    // Reset all stages to pending
    document.querySelectorAll('.stage').forEach(stage => {
        stage.classList.remove('active', 'completed');
        const icon = stage.querySelector('.stage-icon');
        icon.classList.remove('active', 'completed');
        icon.classList.add('pending');
    });
    
    // Reset stats
    elements.statImages.textContent = '-';
    elements.statVertices.textContent = '-';
    elements.statFaces.textContent = '-';
    elements.statTime.textContent = '-';
    
    // Reset upload button
    elements.uploadBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Upload & Start Reconstruction
    `;
    
    setState(AppState.IDLE);
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    console.log('3D Reconstruction System initialized');
    
    initUploadHandlers();
    initViewerControls();
    initMiniGames();
    updateButtonStates();
    
    setState(AppState.IDLE);
});

// ─────────────────────────────────────────────────────────────────────────────
// MINI-GAMES (Entertainment during processing)
// ─────────────────────────────────────────────────────────────────────────────

const gameState = {
    quizScore: 0,
    quizStreak: 0,
    currentQuestion: 0,
    featuresCaught: 0,
    featuresMissed: 0,
    catchGameActive: false,
    currentFact: 0
};

// Photogrammetry Quiz Questions
const quizQuestions = [
    {
        question: "What does SIFT stand for in feature detection?",
        options: ["Scale-Invariant Feature Transform", "Simple Image Feature Tool", "Scaled Image Fast Tracking", "Structured Image Feature Transform"],
        correct: 0,
        explanation: "SIFT (Scale-Invariant Feature Transform) detects and describes local features in images, remaining stable under scale and rotation changes."
    },
    {
        question: "How many images minimum are needed for basic 3D reconstruction?",
        options: ["1", "2", "3", "10"],
        correct: 1,
        explanation: "With just 2 images (stereo vision), you can compute depth through triangulation. However, more images improve accuracy!"
    },
    {
        question: "What does MVS stand for in photogrammetry?",
        options: ["Multiple View System", "Multi-View Stereo", "Machine Vision Software", "Model Vertex Smoothing"],
        correct: 1,
        explanation: "Multi-View Stereo (MVS) uses multiple calibrated images to reconstruct a dense 3D point cloud."
    },
    {
        question: "What percentage of overlap between images is typically recommended?",
        options: ["20-30%", "40-50%", "60-80%", "90-100%"],
        correct: 2,
        explanation: "60-80% overlap ensures sufficient common features between consecutive images for reliable matching."
    },
    {
        question: "What is bundle adjustment used for?",
        options: ["Compressing images", "Refining camera poses and 3D points", "Color correction", "Mesh smoothing"],
        correct: 1,
        explanation: "Bundle adjustment jointly optimizes camera parameters and 3D point positions to minimize reprojection error."
    },
    {
        question: "Which surface type is most challenging for photogrammetry?",
        options: ["Textured surfaces", "Reflective/shiny surfaces", "Matte surfaces", "Rough surfaces"],
        correct: 1,
        explanation: "Reflective and transparent surfaces cause issues because they don't have consistent appearance across viewpoints."
    },
    {
        question: "What is epipolar geometry?",
        options: ["3D printing technique", "Relationship between 2 views of a scene", "A type of mesh", "Camera lens distortion"],
        correct: 1,
        explanation: "Epipolar geometry describes the geometric relationship between two camera views, constraining where matching points can appear."
    },
    {
        question: "What is the purpose of Poisson reconstruction?",
        options: ["Feature detection", "Image enhancement", "Surface mesh from point cloud", "Camera calibration"],
        correct: 2,
        explanation: "Poisson surface reconstruction creates a watertight mesh from an oriented point cloud using implicit functions."
    },
    {
        question: "What causes 'noise' in a reconstructed point cloud?",
        options: ["Too many images", "Mismatched features or depth estimation errors", "High resolution cameras", "Good lighting"],
        correct: 1,
        explanation: "Noise comes from incorrectly matched features or inaccurate depth estimation, especially in low-texture areas."
    },
    {
        question: "What is camera intrinsic calibration?",
        options: ["Positioning the camera", "Determining focal length, principal point, distortion", "Choosing ISO settings", "White balance adjustment"],
        correct: 1,
        explanation: "Intrinsic calibration determines internal camera parameters: focal length, principal point, and lens distortion coefficients."
    }
];

// Fun Facts about Photogrammetry
const funFacts = [
    { icon: "🏛️", text: "Photogrammetry was first used in 1849 by Aimé Laussedat to create topographic maps from photographs!" },
    { icon: "🚀", text: "NASA uses photogrammetry to create 3D models of asteroids and planetary surfaces from spacecraft images." },
    { icon: "🎮", text: "Many video game environments are created using photogrammetry - games like Star Wars Battlefront scan real-world locations!" },
    { icon: "🎬", text: "Hollywood uses photogrammetry for visual effects. The dinosaurs in Jurassic World were based on 3D scanned sculptures." },
    { icon: "🏺", text: "Archaeologists use photogrammetry to digitally preserve artifacts and ancient sites before they deteriorate." },
    { icon: "📏", text: "A single SIFT keypoint contains 128 numbers describing the local image gradient patterns around it." },
    { icon: "🧮", text: "COLMAP can process thousands of features per image - a typical dataset might have millions of 3D points!" },
    { icon: "🔬", text: "The human eye uses the same triangulation principle as photogrammetry - it's called stereopsis!" },
    { icon: "🌍", text: "Google Earth's 3D buildings are created using aerial photogrammetry from planes and satellites." },
    { icon: "⚡", text: "Modern GPUs can accelerate photogrammetry - feature matching is highly parallelizable!" }
];

function initMiniGames() {
    // Game tab switching
    document.querySelectorAll('.game-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const game = tab.dataset.game;
            switchGame(game);
        });
    });
    
    // Initialize quiz
    loadQuizQuestion();
    
    // Initialize facts
    updateFactDisplay();
    
    // Fact navigation
    const prevFact = document.getElementById('prevFact');
    const nextFact = document.getElementById('nextFact');
    if (prevFact) prevFact.addEventListener('click', () => navigateFact(-1));
    if (nextFact) nextFact.addEventListener('click', () => navigateFact(1));
    
    // Feature catch game
    const startCatchBtn = document.getElementById('startCatchGame');
    if (startCatchBtn) {
        startCatchBtn.addEventListener('click', startCatchGame);
    }
}

function switchGame(game) {
    // Update tabs
    document.querySelectorAll('.game-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.game === game);
    });
    
    // Update content
    const quizGame = document.getElementById('quizGame');
    const catchGame = document.getElementById('catchGame');
    const factsGame = document.getElementById('factsGame');
    
    if (quizGame) quizGame.classList.toggle('hidden', game !== 'quiz');
    if (catchGame) catchGame.classList.toggle('hidden', game !== 'catch');
    if (factsGame) factsGame.classList.toggle('hidden', game !== 'facts');
    
    // Stop catch game if switching away
    if (game !== 'catch') {
        gameState.catchGameActive = false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// QUIZ GAME
// ═══════════════════════════════════════════════════════════════════════════
function loadQuizQuestion() {
    const questionEl = document.querySelector('.question-text');
    const optionsEl = document.getElementById('quizOptions');
    const feedbackEl = document.getElementById('quizFeedback');
    
    if (!questionEl || !optionsEl) return;
    
    // Hide feedback
    if (feedbackEl) feedbackEl.classList.add('hidden');
    
    // Get random question (avoid repeating recent ones)
    const availableIndices = quizQuestions.map((_, i) => i);
    const questionIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    const question = quizQuestions[questionIndex];
    gameState.currentQuestion = questionIndex;
    
    questionEl.textContent = question.question;
    
    optionsEl.innerHTML = question.options.map((option, index) => `
        <button class="quiz-option" data-index="${index}">${option}</button>
    `).join('');
    
    // Add click handlers
    optionsEl.querySelectorAll('.quiz-option').forEach(btn => {
        btn.addEventListener('click', () => handleQuizAnswer(parseInt(btn.dataset.index)));
    });
}

function handleQuizAnswer(selectedIndex) {
    const question = quizQuestions[gameState.currentQuestion];
    const options = document.querySelectorAll('.quiz-option');
    const feedbackEl = document.getElementById('quizFeedback');
    const scoreEl = document.getElementById('quizScore');
    const streakEl = document.getElementById('quizStreak');
    
    // Disable all options
    options.forEach(opt => opt.classList.add('disabled'));
    
    // Mark correct/incorrect
    options.forEach((opt, index) => {
        if (index === question.correct) {
            opt.classList.add('correct');
        } else if (index === selectedIndex) {
            opt.classList.add('incorrect');
        }
    });
    
    // Update score and show feedback
    if (selectedIndex === question.correct) {
        gameState.quizScore += 10 + (gameState.quizStreak * 2);
        gameState.quizStreak++;
        if (feedbackEl) {
            feedbackEl.className = 'quiz-feedback correct';
            feedbackEl.innerHTML = `✅ Correct! ${question.explanation}`;
            feedbackEl.classList.remove('hidden');
        }
    } else {
        gameState.quizStreak = 0;
        if (feedbackEl) {
            feedbackEl.className = 'quiz-feedback incorrect';
            feedbackEl.innerHTML = `❌ Not quite! ${question.explanation}`;
            feedbackEl.classList.remove('hidden');
        }
    }
    
    // Update display
    if (scoreEl) scoreEl.textContent = gameState.quizScore;
    if (streakEl) streakEl.textContent = gameState.quizStreak;
    
    // Load next question after delay
    setTimeout(loadQuizQuestion, 3000);
}

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE CATCH GAME
// ═══════════════════════════════════════════════════════════════════════════
function startCatchGame() {
    const arena = document.getElementById('catchArena');
    const instructions = arena.querySelector('.catch-instructions');
    const scoreDisplay = document.getElementById('catchScore');
    
    if (!arena) return;
    
    // Hide instructions, show score
    if (instructions) instructions.classList.add('hidden');
    if (scoreDisplay) scoreDisplay.classList.remove('hidden');
    
    // Reset score
    gameState.featuresCaught = 0;
    gameState.featuresMissed = 0;
    gameState.catchGameActive = true;
    updateCatchScore();
    
    // Start spawning features
    spawnFeature();
}

function spawnFeature() {
    if (!gameState.catchGameActive) return;
    
    const arena = document.getElementById('catchArena');
    if (!arena) return;
    
    const feature = document.createElement('div');
    feature.className = 'feature-bubble';
    
    // Random position
    const maxX = arena.clientWidth - 40;
    const maxY = arena.clientHeight - 40;
    const x = Math.random() * maxX;
    const y = 40 + Math.random() * (maxY - 40);
    
    feature.style.left = `${x}px`;
    feature.style.top = `${y}px`;
    
    // Random feature symbol
    const symbols = ['✦', '◈', '✧', '◆', '⬟', '✶'];
    const colors = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'];
    feature.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    feature.style.color = colors[Math.floor(Math.random() * colors.length)];
    feature.style.textShadow = `0 0 10px ${feature.style.color}`;
    
    // Click handler
    feature.addEventListener('click', () => catchFeature(feature));
    
    arena.appendChild(feature);
    
    // Auto-remove after timeout
    const lifetime = 1500 + Math.random() * 1000;
    setTimeout(() => {
        if (feature.parentNode && !feature.classList.contains('caught')) {
            missFeature(feature);
        }
    }, lifetime);
    
    // Spawn next feature
    const spawnDelay = 800 + Math.random() * 700;
    setTimeout(spawnFeature, spawnDelay);
}

function catchFeature(feature) {
    if (feature.classList.contains('caught') || feature.classList.contains('missed')) return;
    
    feature.classList.add('caught');
    gameState.featuresCaught++;
    updateCatchScore();
    
    setTimeout(() => {
        if (feature.parentNode) feature.remove();
    }, 300);
}

function missFeature(feature) {
    if (feature.classList.contains('caught') || feature.classList.contains('missed')) return;
    
    feature.classList.add('missed');
    gameState.featuresMissed++;
    updateCatchScore();
    
    setTimeout(() => {
        if (feature.parentNode) feature.remove();
    }, 500);
}

function updateCatchScore() {
    const caughtEl = document.getElementById('featuresCaught');
    const missedEl = document.getElementById('featuresMissed');
    
    if (caughtEl) caughtEl.textContent = gameState.featuresCaught;
    if (missedEl) missedEl.textContent = gameState.featuresMissed;
}

// ═══════════════════════════════════════════════════════════════════════════
// FUN FACTS CAROUSEL
// ═══════════════════════════════════════════════════════════════════════════
function updateFactDisplay() {
    const factCard = document.getElementById('factCard');
    const factCounter = document.getElementById('factCounter');
    
    if (!factCard) return;
    
    const fact = funFacts[gameState.currentFact];
    
    factCard.innerHTML = `
        <div class="fact-icon">${fact.icon}</div>
        <p class="fact-text">${fact.text}</p>
    `;
    
    if (factCounter) {
        factCounter.textContent = `${gameState.currentFact + 1}/${funFacts.length}`;
    }
}

function navigateFact(direction) {
    gameState.currentFact += direction;
    
    if (gameState.currentFact < 0) {
        gameState.currentFact = funFacts.length - 1;
    } else if (gameState.currentFact >= funFacts.length) {
        gameState.currentFact = 0;
    }
    
    updateFactDisplay();
}
