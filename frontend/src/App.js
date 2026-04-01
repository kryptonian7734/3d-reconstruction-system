import React, { useState } from 'react';
import UploadForm from './UploadForm';
import StatusPoller from './StatusPoller';
import ModelViewer from './ModelViewer';
import { Container, Typography, Box, Paper, CssBaseline } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [jobId, setJobId] = useState(null);
  const [ready, setReady] = useState(false);

  const handleUploadComplete = (id) => {
    setJobId(id);
    setReady(false);
  };

  const handleReady = () => {
    setReady(true);
  };

  return (
    <>
      <CssBaseline />
      <Box sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #e0e7ff 0%, #f5f7fa 100%)',
        py: { xs: 2, md: 6 },
        px: { xs: 0, md: 0 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <Container maxWidth="md" disableGutters>
          <Box sx={{ mt: { xs: 2, md: 6 }, mb: 6, textAlign: 'center' }}>
            <motion.h1
              className="hero-gradient"
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, type: 'spring' }}
              style={{ fontSize: '3rem', fontWeight: 900, margin: 0, letterSpacing: 2 }}
            >
              3D Reconstruction System
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              style={{ fontSize: '1.25rem', color: '#4b5563', marginTop: 16, marginBottom: 0 }}
            >
              Upload your 2D images and generate a beautiful interactive 3D model in your browser.
            </motion.p>
          </Box>
          <AnimatePresence mode="wait">
            <motion.div
              key={jobId ? 'job' : 'hero'}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.6 }}
            >
              <Paper elevation={8} className="glass" sx={{ p: { xs: 2, md: 4 }, borderRadius: 6, boxShadow: 12, mb: 6 }}>
                {!jobId && <UploadForm onUploadComplete={handleUploadComplete} />}
                {jobId && !ready && <StatusPoller jobId={jobId} onReady={handleReady} />}
                {jobId && ready && <ModelViewer jobId={jobId} />}
              </Paper>
            </motion.div>
          </AnimatePresence>
        </Container>
        <Box sx={{ textAlign: 'center', color: '#888', fontSize: 14, mt: 4, mb: 2, opacity: 0.7 }}>
          Made with <span style={{ color: '#6366f1', fontWeight: 700 }}>AI</span> &amp; ❤️
        </Box>
      </Box>
    </>
  );
}

export default App;