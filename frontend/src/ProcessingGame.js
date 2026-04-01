import React, { useRef, useEffect, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';

// Simple "Catch the Star" game: tap the moving star to score points
  const canvasRef = useRef();
  const starRef = useRef({ x: 80, y: 80, r: 22, vx: 3, vy: 2 });
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animation;
    function drawStar(cx, cy, spikes, outerRadius, innerRadius, color) {
      let rot = Math.PI / 2 * 3;
      let x = cx;
      let y = cy;
      let step = Math.PI / spikes;
      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;
        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const s = starRef.current;
      drawStar(s.x, s.y, 5, s.r, s.r / 2, '#facc15');
    }
    function update() {
      let s = starRef.current;
      let { x, y, r, vx, vy } = s;
      x += vx;
      y += vy;
      if (x + r > canvas.width || x - r < 0) vx *= -1;
      if (y + r > canvas.height || y - r < 0) vy *= -1;
      starRef.current = { ...s, x, y, vx, vy };
    }
    function loop() {
      if (!running) return;
      update();
      draw();
      animation = requestAnimationFrame(loop);
    }
    loop();
    return () => {
      cancelAnimationFrame(animation);
    };
    // eslint-disable-next-line
  }, [running]);

  function handleCanvasClick(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = starRef.current;
    const dx = x - s.x;
    const dy = y - s.y;
    if (dx * dx + dy * dy <= s.r * s.r * 1.2) {
      setScore((sc) => sc + 1);
      // Move star to a new random position and velocity
      starRef.current = {
        ...s,
        x: Math.random() * 260 + 30,
        y: Math.random() * 140 + 30,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8
      };
    }
  }

  function handleReset() {
    setScore(0);
    starRef.current = { x: 80, y: 80, r: 22, vx: 3, vy: 2 };
    setRunning(true);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: '#facc15', fontWeight: 700, mb: 1 }}>
          Catch the Star!
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
          Score: {score}
        </Typography>
        <canvas
          ref={canvasRef}
          width={320}
          height={200}
          style={{ borderRadius: 16, background: 'rgba(255,251,235,0.8)', boxShadow: '0 4px 24px 0 rgba(250,204,21,0.10)', cursor: 'pointer' }}
          onClick={handleCanvasClick}
        />
        <Button onClick={handleReset} size="small" sx={{ mt: 1, color: '#facc15' }}>Reset</Button>
      </Box>
    </motion.div>
  );
}

export default ProcessingGame;
