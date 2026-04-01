import React, { useState, useRef } from 'react';
import { Button, Box, Typography, LinearProgress, Paper } from '@mui/material';
import { motion } from 'framer-motion';

function UploadForm({ onUploadComplete }) {
  const MAX_IMAGES = 50;
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [quality, setQuality] = useState('balanced');
  const dropRef = useRef();

  const handleFileChange = (e) => {
    const selected = [...e.target.files];
    if (selected.length > MAX_IMAGES) {
      setError(`You can upload up to ${MAX_IMAGES} images at once.`);
    } else {
      setError(null);
    }
    setFiles(selected.slice(0, MAX_IMAGES));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const selected = [...e.dataTransfer.files];
    if (selected.length > MAX_IMAGES) {
      setError(`You can upload up to ${MAX_IMAGES} images at once.`);
    } else {
      setError(null);
    }
    setFiles(selected.slice(0, MAX_IMAGES));
    dropRef.current.classList.remove('dragover');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    dropRef.current.classList.add('dragover');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dropRef.current.classList.remove('dragover');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setError(null);
    setProgress(0);
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('quality', quality);
    try {
      // Use XMLHttpRequest for progress
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/upload');
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        setUploading(false);
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          if (data.job_id) {
            onUploadComplete(data.job_id);
          } else {
            setError('Upload failed.');
          }
        } else {
          setError('Upload error.');
        }
      };
      xhr.onerror = () => {
        setUploading(false);
        setError('Upload error.');
      };
      xhr.send(formData);
    } catch (err) {
      setUploading(false);
      setError('Upload error.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Paper
        ref={dropRef}
        elevation={0}
        className="glass"
        sx={{
          p: 3,
          mb: 2,
          border: '2px dashed #6366f1',
          background: 'rgba(255,255,255,0.8)',
          textAlign: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          transition: 'box-shadow 0.3s',
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Typography variant="h6" sx={{ mb: 2, color: '#6366f1', fontWeight: 700 }}>
          Drag & Drop images here or click to select
        </Typography>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          style={{ display: 'none' }}
          id="file-upload"
        />
        <label htmlFor="file-upload">
          <Button
            variant="contained"
            color="primary"
            component="span"
            disabled={uploading}
            sx={{ mb: 2 }}
          >
            {uploading ? 'Uploading...' : 'Select Images'}
          </Button>
        </label>
        {files.length > 0 && (
          <Typography variant="body2" sx={{ mt: 1, color: '#333' }}>
            {files.length} file{files.length > 1 ? 's' : ''} selected (max {MAX_IMAGES})
          </Typography>
        )}
        <Box sx={{ mt: 2, textAlign: 'left' }}>
          <Typography variant="body2" sx={{ mb: 1, color: '#475569', fontWeight: 600 }}>
            Reconstruction mode
          </Typography>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            disabled={uploading}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              backgroundColor: '#fff'
            }}
          >
            <option value="fast">Fast (Preview)</option>
            <option value="balanced">Balanced</option>
            <option value="high_quality">High Quality</option>
          </select>
        </Box>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            color="secondary"
            type="submit"
            disabled={uploading || files.length === 0}
            sx={{ width: '100%', fontWeight: 700 }}
          >
            {uploading ? 'Uploading...' : 'Upload Images'}
          </Button>
        </Box>
        {uploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" sx={{ ml: 1 }}>{progress}%</Typography>
          </Box>
        )}
        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
      </Paper>
    </motion.div>
  );
}

export default UploadForm;
