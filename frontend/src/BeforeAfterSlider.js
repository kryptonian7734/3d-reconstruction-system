import React, { useRef, useEffect, useState } from 'react';
import { Box, Typography, Paper, Slider } from '@mui/material';
import { motion } from 'framer-motion';

// Place two sample images in public/static: before.jpg, after.jpg
function BeforeAfterSlider() {
  const [value, setValue] = useState(50);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Paper elevation={8} className="glass" sx={{ mt: 3, p: 2, borderRadius: 4, boxShadow: '0 8px 32px 0 rgba(99,102,241,0.10)' }}>
        <Typography variant="h6" align="center" sx={{ mb: 2, color: '#6366f1', fontWeight: 700 }}>
          Before / After Example
        </Typography>
        <Box sx={{ position: 'relative', width: '100%', height: 220, mb: 2 }}>
          <img src="/static/before.jpg" alt="Before" style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 8, position: 'absolute', top: 0, left: 0 }} />
          <img src="/static/after.jpg" alt="After" style={{ width: `${value}%`, height: 220, objectFit: 'cover', borderRadius: 8, position: 'absolute', top: 0, left: 0, overflow: 'hidden', clipPath: `inset(0 ${100-value}% 0 0)` }} />
        </Box>
        <Slider value={value} onChange={(_, v) => setValue(v)} min={0} max={100} sx={{ color: '#6366f1' }} />
      </Paper>
    </motion.div>
  );
}

export default BeforeAfterSlider;
