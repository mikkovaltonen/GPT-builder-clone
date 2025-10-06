import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import {
  Box,
  Typography,
  AppBar,
  Toolbar,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Container,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Grid
} from '@mui/material';
import { 
  ContentCopy, 
  Search,
  ThumbUp,
  ThumbDown,
  Message,
  CalendarToday,
  Delete
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import './Improvement.css';

const Improvement = () => {
  const [chatHistories, setChatHistories] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assistants, setAssistants] = useState([]);
  const [selectedAssistant, setSelectedAssistant] = useState('');
  const navigate = useNavigate();
  const [sidebarWidth] = useState(250);

  // Load assistants from Firebase configs collection
  const loadAssistants = useCallback(async () => {
    try {
      const configsRef = collection(db, 'configs');
      const snapshot = await getDocs(configsRef);
      const assistantsList = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(assistant => assistant.userEmail === auth.currentUser?.email);
      
      setAssistants(assistantsList);
    } catch (error) {
      console.error('Error loading assistants:', error);
    }
  }, []);

  useEffect(() => {
    loadAssistants();
    fetchChatHistories();
  }, [loadAssistants]);

  const fetchChatHistories = async () => {
    try {
      const chatsRef = collection(db, 'Airbnb_chathistory');
      const snapshot = await getDocs(chatsRef);
      const histories = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Add all chats for now - we'll filter by assistant ownership later
        histories.push({ id: doc.id, ...data });
      });
      
      setChatHistories(histories.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return bTime - aTime;
      }));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching chat histories:', error);
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('fi-FI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFirstUserMessage = (messages) => {
    if (!messages || messages.length === 0) return 'No messages';
    const userMessage = messages.find(m => m.role === 'user');
    return userMessage ? userMessage.content.substring(0, 50) + '...' : 'No user message';
  };


  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };


  const handleDeleteChat = async (chatId) => {
    if (window.confirm('Are you sure you want to delete this chat session? This action cannot be undone.')) {
      try {
        // Delete from Firebase
        await deleteDoc(doc(db, 'Airbnb_chathistory', chatId));
        
        // Update local state
        setChatHistories(prevHistories => 
          prevHistories.filter(c => c.id !== chatId)
        );
        
        // Clear selected chat if it was the deleted one
        if (selectedChat?.id === chatId) {
          setSelectedChat(null);
        }
      } catch (error) {
        console.error('Error deleting chat:', error);
        alert('Error deleting chat. Please try again.');
      }
    }
  };

  // Filter chat histories based on selected assistant
  const filteredChatHistories = selectedAssistant 
    ? chatHistories.filter(chat => {
        // Check if chat belongs to selected assistant by publishId
        const assistant = assistants.find(a => a.id === selectedAssistant);
        return assistant && chat.publishId === assistant.publishId;
      })
    : [];

  // Auto-select first assistant if none selected and assistants are loaded
  useEffect(() => {
    if (!selectedAssistant && assistants.length > 0) {
      setSelectedAssistant(assistants[0].id);
    }
  }, [assistants, selectedAssistant]);

  return (
    <Box sx={{ 
      display: 'flex',
      minHeight: '100vh',
      bgcolor: '#f8f9fa'
    }}>
      {/* Sidebar */}
      <Box 
        sx={{ 
          width: { xs: 0, md: sidebarWidth },
          display: { xs: 'none', md: 'block' },
          transition: 'width 0.3s ease',
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
          boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          position: 'fixed',
          height: '100vh',
          zIndex: 1200
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
              sx={{ 
                color: 'primary.main',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.12)'
                }
              }}
            >
              <ListItemText 
                primary="New AI assistant"
                sx={{
                  '& .MuiListItemText-primary': {
                    fontWeight: 400
                  }
                }}
              />
            </ListItemButton>
          </ListItem>
          <Divider />
          {assistants.map((assistant) => (
            <ListItem 
              key={assistant.id}
              disablePadding
            >
              <ListItemButton 
                selected={selectedAssistant === assistant.id}
                onClick={() => setSelectedAssistant(assistant.id)}
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
                      fontWeight: selectedAssistant === assistant.id ? 600 : 400
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Main Content */}
      <Box sx={{ 
        flexGrow: 1,
        marginLeft: { xs: 0, md: `${sidebarWidth}px` }
      }}>
        {/* Header */}
        <AppBar 
          position="sticky" 
          elevation={0}
          sx={{ 
            bgcolor: 'background.paper',
            borderBottom: '1px solid #e0e0e0'
          }}
        >
          <Toolbar sx={{ minHeight: '56px' }}>
            {/* Left side: Logo and page title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Logo size="small" />
              <Typography 
                variant="h6" 
                color="text.primary"
                sx={{ 
                  fontWeight: 500,
                  fontSize: '1.1rem'
                }}
              >
                Chat History & Improvement
              </Typography>
            </Box>

            {/* Center: Config link */}
            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="text"
                size="small"
                onClick={() => navigate('/config/new')}
                sx={{ 
                  color: 'primary.main',
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.08)'
                  }
                }}
              >
                Configuration
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Grid container spacing={3}>
            {/* Chat Sessions List */}
            <Grid item xs={12} md={4}>
              <Paper elevation={0} sx={{ bgcolor: '#1a1a1a', p: 2, height: 'calc(100vh - 180px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: '#F39C12', fontSize: '1.1rem' }}>
                    Chat Sessions
                  </Typography>
                  <Chip 
                    label={`${filteredChatHistories.length} chats`} 
                    size="small" 
                    sx={{ bgcolor: '#2a2a2a', color: '#fff' }}
                  />
                </Box>
                
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <Typography sx={{ color: '#F39C12' }}>Loading...</Typography>
                  </Box>
                ) : (
                  <Box sx={{ overflow: 'auto', flex: 1 }}>
                    {filteredChatHistories.map((chat) => {
                      return (
                        <Paper
                          key={chat.id}
                          elevation={0}
                          sx={{
                            bgcolor: selectedChat?.id === chat.id ? '#333' : '#2a2a2a',
                            p: 2,
                            mb: 1,
                            border: selectedChat?.id === chat.id ? '2px solid #F39C12' : '2px solid transparent',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              bgcolor: '#333',
                              borderColor: '#F39C12'
                            }
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Box 
                              sx={{ flex: 1, cursor: 'pointer' }}
                              onClick={() => setSelectedChat(chat)}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <CalendarToday sx={{ fontSize: 16, color: '#999' }} />
                                <Typography variant="caption" sx={{ color: '#999' }}>
                                  {formatDate(chat.createdAt)}
                                </Typography>
                              </Box>
                            </Box>
                            <Tooltip title="Delete chat session">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteChat(chat.id);
                                }}
                                sx={{ 
                                  color: '#666', 
                                  '&:hover': { color: '#f44336' },
                                  ml: 1
                                }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          
                          <Box 
                            sx={{ cursor: 'pointer' }}
                            onClick={() => setSelectedChat(chat)}
                          >
                            <Typography variant="body2" sx={{ color: '#F39C12', mb: 1, fontWeight: 500, fontSize: '0.85rem' }}>
                              {chat.botName || 'Unknown Assistant'}
                            </Typography>
                            
                            <Typography variant="body2" sx={{ color: '#fff', mb: 1, fontWeight: 400 }}>
                              {getFirstUserMessage(chat.messages)}
                            </Typography>
                            
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Chip
                                icon={<Message sx={{ fontSize: 14 }} />}
                                label={`${chat.messages?.length || 0} messages`}
                                size="small"
                                sx={{ bgcolor: '#444', color: '#fff', height: 24 }}
                              />
                            </Box>
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                )}
              </Paper>
            </Grid>
            {/* Chat Detail */}
            <Grid item xs={12} md={8}>
              <Paper elevation={0} sx={{ bgcolor: '#1a1a1a', p: 2, height: 'calc(100vh - 180px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {selectedChat ? (
                  <>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, pb: 2, borderBottom: '1px solid #444' }}>
                      <Box>
                        <Typography variant="h6" sx={{ color: '#F39C12', fontSize: '1.1rem' }}>
                          {selectedChat.botName || 'Chat History'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#999' }}>
                          {formatDate(selectedChat.createdAt)} • {selectedChat.messages?.length || 0} messages
                        </Typography>
                      </Box>
                    </Box>
                    
                    {/* Messages */}
                    <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
                      {selectedChat.messages?.map((message, index) => (
                        <Box key={index} sx={{ mb: 2 }}>
                          <Paper
                            elevation={0}
                            sx={{
                              bgcolor: message.role === 'user' ? '#1e3a5f' : '#2a2a2a',
                              p: 2,
                              ml: message.role === 'user' ? 6 : 0,
                              mr: message.role === 'user' ? 0 : 6,
                              position: 'relative'
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Typography variant="subtitle2" sx={{ color: '#F39C12', fontWeight: 600 }}>
                                {message.role === 'user' ? 'You' : selectedChat.botName || 'Assistant'}
                              </Typography>
                              <Tooltip title="Copy message">
                                <IconButton 
                                  size="small" 
                                  onClick={() => copyToClipboard(message.content)}
                                  sx={{ color: '#666', '&:hover': { color: '#999' } }}
                                >
                                  <ContentCopy fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                            
                            <Typography variant="body2" sx={{ color: '#fff', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                              {message.content}
                            </Typography>
                            
                            {/* Grounding Metadata */}
                            {message.groundingMetadata?.webSearchQueries && (
                              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #444' }}>
                                <Typography variant="caption" sx={{ color: '#999', display: 'block', mb: 1 }}>
                                  Web searches performed:
                                </Typography>
                                {message.groundingMetadata.webSearchQueries.map((query, idx) => (
                                  <Chip
                                    key={idx}
                                    label={query}
                                    size="small"
                                    icon={<Search sx={{ fontSize: 14 }} />}
                                    sx={{ bgcolor: '#444', color: '#fff', mr: 1, mb: 1 }}
                                  />
                                ))}
                              </Box>
                            )}
                            
                            {/* Feedback display for assistant messages */}
                            {message.role === 'assistant' && (
                              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #444' }}>
                                
                                {/* Show feedback if exists */}
                                {message.feedback ? (
                                  <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                      {message.feedback === 'good' ? (
                                        <Chip
                                          icon={<ThumbUp sx={{ fontSize: 14 }} />}
                                          label="Hyvä vastaus"
                                          size="small"
                                          sx={{ bgcolor: 'rgba(76, 175, 80, 0.2)', color: '#4CAF50' }}
                                        />
                                      ) : (
                                        <Chip
                                          icon={<ThumbDown sx={{ fontSize: 14 }} />}
                                          label="Huono vastaus"
                                          size="small"
                                          sx={{ bgcolor: 'rgba(244, 67, 54, 0.2)', color: '#f44336' }}
                                        />
                                      )}
                                    </Box>
                                    
                                    {/* Always show comment area for bad feedback */}
                                    {message.feedback === 'bad' && (
                                      <Typography variant="caption" sx={{ color: '#999', fontStyle: 'italic', display: 'block', ml: 1 }}>
                                        Kommentti: {message.feedbackComment || '[Ei kommenttia annettu]'}
                                      </Typography>
                                    )}
                                  </Box>
                                ) : (
                                  <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                                    [Ei palautetta annettu]
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </Paper>
                        </Box>
                      ))}
                    </Box>
                  </>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Typography variant="h6" sx={{ color: '#666' }}>
                      Select a chat to view its history
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
};

export default Improvement;