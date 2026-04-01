"""
═══════════════════════════════════════════════════════════════════════════════
POST-PROCESSING MODULE
Generates high-quality mesh and GLB matching COLMAP visual quality
═══════════════════════════════════════════════════════════════════════════════
"""

import open3d as o3d
import os
import numpy as np


def generate_mesh_and_glb(dense_dir: str, use_ball_pivoting=False, poisson_depth=9):
    """
    Generate mesh and GLB from dense point cloud with COLMAP-quality output.
    
    Args:
        dense_dir: Directory containing fused.ply
        use_ball_pivoting: Use Ball Pivoting (faster) vs Poisson (better quality)
        poisson_depth: Depth for Poisson reconstruction (higher = more detail)
    """
    fused_ply = os.path.join(dense_dir, "fused.ply")

    if not os.path.exists(fused_ply):
        raise FileNotFoundError("fused.ply not found")

    print("[INFO] Loading dense point cloud...")
    pcd = o3d.io.read_point_cloud(fused_ply)
    
    # Get original point count for stats
    original_points = len(pcd.points)
    print(f"[INFO] Loaded {original_points:,} points")

    # ══════════════════════════════════════════════════════════════════════════
    # POINT CLOUD CLEANING (improves mesh quality significantly)
    # ══════════════════════════════════════════════════════════════════════════
    
    print("[INFO] Cleaning point cloud (statistical outlier removal)...")
    pcd, ind = pcd.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)
    print(f"[INFO] Removed {original_points - len(pcd.points):,} outlier points")
    
    # ══════════════════════════════════════════════════════════════════════════
    # NORMAL ESTIMATION (critical for mesh quality)
    # ══════════════════════════════════════════════════════════════════════════
    
    print("[INFO] Estimating normals with adaptive radius...")
    # Use adaptive radius based on point density
    distances = pcd.compute_nearest_neighbor_distance()
    avg_dist = np.mean(distances)
    radius = avg_dist * 3  # Adaptive radius
    
    pcd.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(
            radius=radius, max_nn=50
        )
    )
    
    # Orient normals consistently (important for Poisson)
    print("[INFO] Orienting normals consistently...")
    pcd.orient_normals_consistent_tangent_plane(k=15)

    # ══════════════════════════════════════════════════════════════════════════
    # MESH GENERATION
    # ══════════════════════════════════════════════════════════════════════════
    
    if use_ball_pivoting:
        print("[INFO] Generating mesh (Ball Pivoting)...")
        radii = [avg_dist * 1.0, avg_dist * 1.5, avg_dist * 2.0, avg_dist * 2.5]
        mesh = o3d.geometry.TriangleMesh.create_from_point_cloud_ball_pivoting(
            pcd, o3d.utility.DoubleVector(radii)
        )
    else:
        print(f"[INFO] Generating mesh (Poisson, depth={poisson_depth})...")
        mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
            pcd, depth=poisson_depth, width=0, scale=1.1, linear_fit=False
        )
        
        # Remove low-density vertices (reduces artifacts at boundaries)
        print("[INFO] Removing low-density mesh regions...")
        densities = np.asarray(densities)
        density_threshold = np.quantile(densities, 0.01)  # Remove bottom 1%
        vertices_to_remove = densities < density_threshold
        mesh.remove_vertices_by_mask(vertices_to_remove)
    
    # ══════════════════════════════════════════════════════════════════════════
    # MESH CLEANING
    # ══════════════════════════════════════════════════════════════════════════
    
    print("[INFO] Cleaning mesh...")
    mesh.remove_degenerate_triangles()
    mesh.remove_duplicated_triangles()
    mesh.remove_duplicated_vertices()
    mesh.remove_non_manifold_edges()
    
    # Smooth mesh slightly for better appearance
    print("[INFO] Applying light smoothing...")
    mesh = mesh.filter_smooth_simple(number_of_iterations=1)
    
    # Recompute normals for smooth shading
    mesh.compute_vertex_normals()

    # ══════════════════════════════════════════════════════════════════════════
    # COLOR TRANSFER (preserves original COLMAP colors)
    # ══════════════════════════════════════════════════════════════════════════
    
    if pcd.has_colors():
        print("[INFO] Transferring vertex colors from point cloud...")
        pcd_tree = o3d.geometry.KDTreeFlann(pcd)
        mesh_colors = []
        
        for v in mesh.vertices:
            [_, idx, _] = pcd_tree.search_knn_vector_3d(v, 1)
            mesh_colors.append(pcd.colors[idx[0]])
        
        mesh.vertex_colors = o3d.utility.Vector3dVector(mesh_colors)
        
        # Enhance colors slightly for better web display
        colors = np.asarray(mesh.vertex_colors)
        # Slight saturation boost
        colors = np.clip(colors * 1.05, 0, 1)
        mesh.vertex_colors = o3d.utility.Vector3dVector(colors)

    # ══════════════════════════════════════════════════════════════════════════
    # COORDINATE TRANSFORM (match COLMAP GUI orientation)
    # ══════════════════════════════════════════════════════════════════════════
    
    print("[INFO] Transforming to Y-up coordinate system...")
    # COLMAP uses Z-up, Three.js/GLB uses Y-up
    rotation = o3d.geometry.get_rotation_matrix_from_xyz((np.pi / 2, 0, 0))
    mesh.rotate(rotation, center=(0, 0, 0))

    # ══════════════════════════════════════════════════════════════════════════
    # SAVE OUTPUTS
    # ══════════════════════════════════════════════════════════════════════════
    
    mesh_ply = os.path.join(dense_dir, "mesh.ply")
    glb_path = os.path.join(dense_dir, "model.glb")

    print("[INFO] Saving mesh.ply...")
    o3d.io.write_triangle_mesh(mesh_ply, mesh, write_vertex_colors=True)

    print("[INFO] Saving model.glb...")
    o3d.io.write_triangle_mesh(glb_path, mesh, write_triangle_uvs=True)
    
    # Save point cloud as well (for optional point cloud viewing)
    pcd_glb = os.path.join(dense_dir, "pointcloud.ply")
    # Rotate point cloud too for consistent viewing
    pcd.rotate(rotation, center=(0, 0, 0))
    o3d.io.write_point_cloud(pcd_glb, pcd)
    
    # Get final stats
    num_vertices = len(mesh.vertices)
    num_triangles = len(mesh.triangles)
    print(f"[INFO] Final mesh: {num_vertices:,} vertices, {num_triangles:,} triangles")

    return glb_path
