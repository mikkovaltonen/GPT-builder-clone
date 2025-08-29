import React from 'react';
import { 
  Box, 
  List, 
  ListItem, 
  ListItemText, 
  Typography,
  ListItemButton,
  Divider
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';

function Sidebar({ assistants = [] }) {
  const navigate = useNavigate();
  const { botId } = useParams();

  // Filter out duplicates by ID
  const uniqueAssistants = Array.from(
    new Map(assistants.map(a => [a.id, a])).values()
  ).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  return (
    <Box 
      sx={{ 
        width: 250, 
        borderRight: 1, 
        borderColor: 'divider',
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}
    >
      {/* Logo */}
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontSize: '1.2rem',
            fontWeight: 'bold',
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>🤖</span>
          My AI Assistants
        </Typography>
      </Box>

      {/* Assistants List */}
      <List>
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => navigate('/config/new')}
            selected={botId === 'new'}
            sx={{ 
              color: 'primary.main',
              '&.Mui-selected': {
                backgroundColor: 'rgba(25, 118, 210, 0.08)',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.12)'
                }
              }
            }}
          >
            <ListItemText 
              primary="New AI assistant"
              sx={{
                '& .MuiListItemText-primary': {
                  fontWeight: botId === 'new' ? 600 : 400
                }
              }}
            />
          </ListItemButton>
        </ListItem>
        <Divider />
        {uniqueAssistants.map((assistant) => (
          <ListItem 
            key={assistant.id}
            disablePadding
          >
            <ListItemButton 
              selected={botId === assistant.id}
              onClick={() => navigate(`/config/${assistant.id}`)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'rgba(25, 118, 210, 0.08)',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.12)'
                  }
                }
              }}
            >
              <ListItemText 
                primary={assistant.name || assistant.id} 
                sx={{ 
                  '& .MuiListItemText-primary': {
                    fontSize: '0.875rem',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    fontWeight: botId === assistant.id ? 600 : 400
                  }
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export default Sidebar; 