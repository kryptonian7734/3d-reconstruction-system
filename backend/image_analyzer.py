"""
═══════════════════════════════════════════════════════════════════════════════
IMAGE QUALITY & COVERAGE ANALYZER
Pre-reconstruction analysis to predict success and provide user guidance
═══════════════════════════════════════════════════════════════════════════════
"""

import os
import cv2
import numpy as np
from dataclasses import dataclass, asdict
from typing import List, Dict, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor
import json


@dataclass
class ImageAnalysis:
    """Analysis results for a single image."""
    filename: str
    blur_score: float  # Higher = sharper (Laplacian variance)
    is_blurry: bool
    brightness: float  # 0-255 average
    contrast: float  # Standard deviation of intensity
    feature_count: int  # SIFT keypoints detected
    has_enough_features: bool
    resolution: Tuple[int, int]
    aspect_ratio: float
    quality_rating: str  # "good", "acceptable", "poor"
    issues: List[str]


@dataclass
class DatasetAnalysis:
    """Analysis results for the entire image dataset."""
    total_images: int
    analyzed_images: int
    
    # Quality metrics
    average_blur_score: float
    blurry_count: int
    low_feature_count: int
    
    # Coverage estimation
    estimated_coverage: str  # "excellent", "good", "limited", "insufficient"
    viewpoint_diversity: float  # 0-1 score
    
    # Recommendations
    overall_rating: str  # "excellent", "good", "fair", "poor"
    success_probability: str  # "high", "medium", "low"
    recommendations: List[str]
    warnings: List[str]
    
    # Per-image results
    image_results: List[Dict]
    
    # Summary stats
    good_images: int
    acceptable_images: int
    poor_images: int


class ImageAnalyzer:
    """
    Analyzes images before reconstruction to predict success and guide users.
    
    This module provides:
    1. Blur detection using Laplacian variance
    2. Feature count estimation using SIFT
    3. Brightness/contrast analysis
    4. Overall quality assessment
    5. Actionable recommendations
    """
    
    # Thresholds (tuned for photogrammetry)
    BLUR_THRESHOLD = 100.0  # Below this = blurry
    MIN_FEATURES = 500  # Minimum SIFT features for good matching
    MIN_BRIGHTNESS = 40  # Too dark below this
    MAX_BRIGHTNESS = 220  # Too bright above this
    MIN_CONTRAST = 30  # Low contrast below this
    MIN_IMAGES = 3  # Absolute minimum for reconstruction
    IDEAL_MIN_IMAGES = 10  # Recommended minimum
    IDEAL_MAX_IMAGES = 50  # Recommended maximum
    
    def __init__(self):
        # Initialize SIFT detector
        self.sift = cv2.SIFT_create(nfeatures=10000)
    
    def analyze_single_image(self, image_path: str) -> ImageAnalysis:
        """Analyze a single image for quality metrics."""
        filename = os.path.basename(image_path)
        issues = []
        
        # Read image
        img = cv2.imread(image_path)
        if img is None:
            return ImageAnalysis(
                filename=filename,
                blur_score=0,
                is_blurry=True,
                brightness=0,
                contrast=0,
                feature_count=0,
                has_enough_features=False,
                resolution=(0, 0),
                aspect_ratio=0,
                quality_rating="poor",
                issues=["Failed to read image"]
            )
        
        height, width = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 1. Blur detection (Laplacian variance)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        blur_score = laplacian.var()
        is_blurry = blur_score < self.BLUR_THRESHOLD
        if is_blurry:
            issues.append("Image appears blurry")
        
        # 2. Brightness analysis
        brightness = np.mean(gray)
        if brightness < self.MIN_BRIGHTNESS:
            issues.append("Image is too dark")
        elif brightness > self.MAX_BRIGHTNESS:
            issues.append("Image is overexposed")
        
        # 3. Contrast analysis
        contrast = np.std(gray)
        if contrast < self.MIN_CONTRAST:
            issues.append("Low contrast - may lack texture")
        
        # 4. Feature detection (SIFT)
        keypoints = self.sift.detect(gray, None)
        feature_count = len(keypoints)
        has_enough_features = feature_count >= self.MIN_FEATURES
        if not has_enough_features:
            issues.append(f"Low feature count ({feature_count})")
        
        # 5. Resolution check
        resolution = (width, height)
        aspect_ratio = width / height if height > 0 else 0
        
        if width < 640 or height < 480:
            issues.append("Resolution too low")
        
        # Calculate quality rating
        quality_score = 0
        if not is_blurry:
            quality_score += 1
        if has_enough_features:
            quality_score += 1
        if self.MIN_BRIGHTNESS <= brightness <= self.MAX_BRIGHTNESS:
            quality_score += 1
        if contrast >= self.MIN_CONTRAST:
            quality_score += 1
        
        if quality_score >= 4:
            quality_rating = "good"
        elif quality_score >= 2:
            quality_rating = "acceptable"
        else:
            quality_rating = "poor"
        
        return ImageAnalysis(
            filename=filename,
            blur_score=round(blur_score, 2),
            is_blurry=is_blurry,
            brightness=round(brightness, 2),
            contrast=round(contrast, 2),
            feature_count=feature_count,
            has_enough_features=has_enough_features,
            resolution=resolution,
            aspect_ratio=round(aspect_ratio, 2),
            quality_rating=quality_rating,
            issues=issues
        )
    
    def estimate_viewpoint_diversity(self, image_analyses: List[ImageAnalysis]) -> float:
        """
        Estimate viewpoint diversity based on feature distribution.
        This is a heuristic - true diversity requires actual feature matching.
        
        Returns a score from 0 to 1.
        """
        if len(image_analyses) < 2:
            return 0.0
        
        # Use feature count variance as a proxy for different viewpoints
        # (different views often have different feature counts)
        feature_counts = [a.feature_count for a in image_analyses if a.feature_count > 0]
        
        if len(feature_counts) < 2:
            return 0.0
        
        # Calculate coefficient of variation
        mean_features = np.mean(feature_counts)
        std_features = np.std(feature_counts)
        
        if mean_features == 0:
            return 0.0
        
        cv = std_features / mean_features
        
        # Map CV to diversity score (some variation is good, too much is bad)
        # Optimal CV is around 0.2-0.4 for good photogrammetry
        if cv < 0.1:
            diversity = 0.5  # Too uniform - possibly duplicate views
        elif cv < 0.3:
            diversity = 0.9  # Good diversity
        elif cv < 0.5:
            diversity = 0.7  # Acceptable
        else:
            diversity = 0.4  # Too much variation - quality issues
        
        # Bonus for having more images
        image_bonus = min(len(image_analyses) / self.IDEAL_MIN_IMAGES, 1.0) * 0.1
        
        return min(diversity + image_bonus, 1.0)
    
    def analyze_dataset(self, image_dir: str) -> DatasetAnalysis:
        """
        Analyze all images in a directory and provide comprehensive assessment.
        """
        # Get all image files
        valid_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif'}
        image_files = []
        
        for f in os.listdir(image_dir):
            ext = os.path.splitext(f)[1].lower()
            if ext in valid_extensions:
                image_files.append(os.path.join(image_dir, f))
        
        total_images = len(image_files)
        
        if total_images == 0:
            return DatasetAnalysis(
                total_images=0,
                analyzed_images=0,
                average_blur_score=0,
                blurry_count=0,
                low_feature_count=0,
                estimated_coverage="insufficient",
                viewpoint_diversity=0,
                overall_rating="poor",
                success_probability="low",
                recommendations=["No images found in the upload"],
                warnings=["Cannot proceed without images"],
                image_results=[],
                good_images=0,
                acceptable_images=0,
                poor_images=0
            )
        
        # Analyze images in parallel
        with ThreadPoolExecutor(max_workers=4) as executor:
            analyses = list(executor.map(self.analyze_single_image, image_files))
        
        # Aggregate results
        blur_scores = [a.blur_score for a in analyses]
        average_blur_score = np.mean(blur_scores) if blur_scores else 0
        
        blurry_count = sum(1 for a in analyses if a.is_blurry)
        low_feature_count = sum(1 for a in analyses if not a.has_enough_features)
        
        good_images = sum(1 for a in analyses if a.quality_rating == "good")
        acceptable_images = sum(1 for a in analyses if a.quality_rating == "acceptable")
        poor_images = sum(1 for a in analyses if a.quality_rating == "poor")
        
        # Estimate viewpoint diversity
        viewpoint_diversity = self.estimate_viewpoint_diversity(analyses)
        
        # Estimate coverage
        if total_images >= 20 and viewpoint_diversity > 0.7:
            estimated_coverage = "excellent"
        elif total_images >= 10 and viewpoint_diversity > 0.5:
            estimated_coverage = "good"
        elif total_images >= 5:
            estimated_coverage = "limited"
        else:
            estimated_coverage = "insufficient"
        
        # Generate recommendations and warnings
        recommendations = []
        warnings = []
        
        if total_images < self.MIN_IMAGES:
            warnings.append(f"Only {total_images} images - minimum {self.MIN_IMAGES} required")
        elif total_images < self.IDEAL_MIN_IMAGES:
            recommendations.append(f"Consider adding more images ({self.IDEAL_MIN_IMAGES}+ recommended)")
        
        if blurry_count > 0:
            if blurry_count > total_images * 0.3:
                warnings.append(f"{blurry_count} blurry images detected - may cause reconstruction failure")
            else:
                recommendations.append(f"Remove {blurry_count} blurry image(s) for better results")
        
        if low_feature_count > total_images * 0.3:
            warnings.append("Many images have low feature counts - ensure textured surfaces")
        
        if poor_images > total_images * 0.5:
            warnings.append("Majority of images have quality issues")
        
        if viewpoint_diversity < 0.3:
            recommendations.append("Try capturing from more varied angles (360° coverage ideal)")
        
        if not recommendations and not warnings:
            recommendations.append("Image set looks good for reconstruction!")
        
        # Calculate overall rating
        quality_score = (good_images * 3 + acceptable_images * 1) / max(total_images, 1)
        
        if quality_score >= 2.5 and total_images >= self.IDEAL_MIN_IMAGES:
            overall_rating = "excellent"
            success_probability = "high"
        elif quality_score >= 1.5 and total_images >= self.MIN_IMAGES:
            overall_rating = "good"
            success_probability = "high"
        elif quality_score >= 0.8 and total_images >= self.MIN_IMAGES:
            overall_rating = "fair"
            success_probability = "medium"
        else:
            overall_rating = "poor"
            success_probability = "low"
        
        return DatasetAnalysis(
            total_images=total_images,
            analyzed_images=len(analyses),
            average_blur_score=round(average_blur_score, 2),
            blurry_count=blurry_count,
            low_feature_count=low_feature_count,
            estimated_coverage=estimated_coverage,
            viewpoint_diversity=round(viewpoint_diversity, 2),
            overall_rating=overall_rating,
            success_probability=success_probability,
            recommendations=recommendations,
            warnings=warnings,
            image_results=[asdict(a) for a in analyses],
            good_images=good_images,
            acceptable_images=acceptable_images,
            poor_images=poor_images
        )


def analyze_images(image_dir: str) -> Dict:
    """
    Convenience function to analyze images and return JSON-serializable dict.
    """
    analyzer = ImageAnalyzer()
    result = analyzer.analyze_dataset(image_dir)
    return asdict(result)
