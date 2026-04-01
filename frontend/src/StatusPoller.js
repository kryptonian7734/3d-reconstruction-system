import React, { useEffect, useState } from 'react';
import { CircularProgress, Typography, Box, Paper } from '@mui/material';
// SampleModelViewer removed
import BrandStory from './BrandStory';
import { motion } from 'framer-motion';

function StatusPoller({ jobId, onReady }) {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobId) return;
    let interval = setInterval(async () => {
      try {
        const res = await fetch(`/status/${jobId}`);
        const data = await res.json();
        if (data.status === 'finished') {
          setStatus('finished');
          clearInterval(interval);
          onReady();
        } else if (data.status === 'error') {
          setStatus('error');
          setError(data.error || 'Reconstruction failed.');
          clearInterval(interval);
        } else {
          setStatus(data.status);
        }
      } catch (err) {
        setStatus('error');
        setError('Status check failed.');
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobId, onReady]);

  if (status === 'processing')
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Paper elevation={8} className="glass" sx={{ mt: 4, p: 2, borderRadius: 4, background: 'rgba(236,239,255,0.7)' }}>
          <Box display="flex" flexDirection="column" alignItems="center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              style={{ display: 'inline-block' }}
            >
              <CircularProgress color="secondary" size={70} thickness={5} sx={{ mb: 2, color: '#6366f1' }} />
            </motion.div>
            <Typography variant="h6" align="center" sx={{ color: '#6366f1', fontWeight: 700, mb: 1 }}>
              Processing your images...
            </Typography>
            <Typography variant="body2" align="center" sx={{ color: '#64748b', fontWeight: 500 }}>
              This may take a minute. Please wait.<br />
              <span style={{ fontSize: 13, color: '#a5b4fc' }}>We are reconstructing your 3D model with AI magic!</span>
            </Typography>
            <Box sx={{ mt: 3, width: '100%' }}>
              <BrandStory />
            </Box>
          </Box>
        </Paper>
      </motion.div>
    );
  if (status === 'error')
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Paper elevation={8} className="glass" sx={{ mt: 4, p: 2, borderRadius: 4, background: 'rgba(255,240,240,0.7)' }}>
          <Typography color="error" align="center" sx={{ fontWeight: 600, fontSize: 18 }}>{error}</Typography>
        </Paper>
      </motion.div>
    );
  return null;
}

export default StatusPoller;
