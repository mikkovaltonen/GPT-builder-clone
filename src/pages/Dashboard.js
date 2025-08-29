import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Button 
        variant="contained" 
        onClick={() => navigate('/config/new')}
      >
        Create New Assistant
      </Button>
    </Box>
  );
}

export default Dashboard; 