import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { motion } from 'framer-motion';

const testimonials = [
  {
    name: 'Amit',
    text: 'This 3D reconstruction tool made my project a breeze! The results are stunning.'
  },
  {
    name: 'Sara',
    text: 'I love how easy it is to use and the interactive 3D viewer is amazing.'
  },
  {
    name: 'Li',
    text: 'The best free photogrammetry tool I have tried. Highly recommended!'
  }
];

function BrandStory() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Paper elevation={8} className="glass" sx={{ mt: 3, p: 3, borderRadius: 4, boxShadow: '0 8px 32px 0 rgba(99,102,241,0.10)' }}>
        <Typography variant="h5" align="center" sx={{ mb: 2, color: '#6366f1', fontWeight: 800 }}>
          Our Mission
        </Typography>
        <Typography align="center" sx={{ mb: 2, color: '#64748b', fontSize: 18 }}>
          Making 3D reconstruction accessible, beautiful, and effortless for everyone. Whether you are a hobbyist, student, or professional, our platform brings your objects to life in 3D.
        </Typography>
        <Typography variant="h6" align="center" sx={{ mt: 3, mb: 1, color: '#6366f1', fontWeight: 700 }}>
          What Our Users Say
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, justifyContent: 'center', alignItems: 'center' }}>
          {testimonials.map((t, i) => (
            <Paper key={i} elevation={4} sx={{ p: 2, borderRadius: 3, minWidth: 200, background: 'rgba(236,239,255,0.7)' }}>
              <Typography sx={{ fontWeight: 600, color: '#6366f1' }}>{t.name}</Typography>
              <Typography sx={{ color: '#64748b', fontStyle: 'italic' }}>
                "{t.text}"
              </Typography>
            </Paper>
          ))}
        </Box>
      </Paper>
    </motion.div>
  );
}

export default BrandStory;
