import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Paper, Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';

function ModelViewer({ jobId }) {
  const mountRef = useRef();

  useEffect(() => {
    if (!jobId) return;
    let renderer, scene, camera, controls, loader, model;
    let width = mountRef.current.clientWidth;
    let height = mountRef.current.clientHeight;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 10000);
    camera.position.set(0, 0, 10);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(10, 10, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);
    import('three/examples/jsm/controls/OrbitControls').then(({ OrbitControls }) => {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      import('three/examples/jsm/loaders/GLTFLoader').then(({ GLTFLoader }) => {
        loader = new GLTFLoader();
        loader.load(
          `/model/${jobId}`,
          (gltf) => {
            model = gltf.scene;
            model.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // Show true vertex colors, no artificial emissive tint
                child.material.emissive = new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0.0;
              }
            });
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);
            const scale = 5 / Math.max(size.x, size.y, size.z);
            model.scale.setScalar(scale);
            scene.add(model);
            controls.target.set(0, 0, 0);
            camera.lookAt(0, 0, 0);
          },
          undefined,
          (err) => {
            // handle error
          }
        );
      });
    });
    function animate() {
      requestAnimationFrame(animate);
      if (controls) controls.update();
      renderer.render(scene, camera);
    }
    animate();
    return () => {
      if (renderer && mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, [jobId]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.6 }}
    >
      <Paper elevation={12} className="glass" sx={{ mt: 4, p: 2, borderRadius: 5, boxShadow: '0 8px 32px 0 rgba(99,102,241,0.18)' }}>
        <Typography variant="h5" align="center" sx={{ mb: 2, color: '#6366f1', fontWeight: 700 }}>
          Interactive 3D Model
        </Typography>
        <Box
          ref={mountRef}
          sx={{ width: '100%', height: 600, background: 'rgba(236,239,255,0.7)', borderRadius: 3, boxShadow: '0 4px 24px 0 rgba(99,102,241,0.10)' }}
        />
      </Paper>
    </motion.div>
  );
}

export default ModelViewer;
