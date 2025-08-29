import React from 'react';
import { Box, Typography } from '@mui/material';

function Logo({ size = 'medium' }) {
  const sizes = {
    small: { text: '1rem', emoji: '1.2rem' },
    medium: { text: '1.25rem', emoji: '1.5rem' },
    large: { text: '1.5rem', emoji: '1.8rem' }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography 
        sx={{ 
          fontSize: sizes[size].emoji,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
        }}
      >
        🤖
      </Typography>
      <Typography 
        variant="h6" 
        sx={{ 
          fontSize: sizes[size].text,
          fontWeight: 'bold',
          color: 'primary.main',
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        AI Assistant Builder
      </Typography>
    </Box>
  );
}

export default Logo; 