import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button,
  Grid,
  Container,
  AppBar,
  Toolbar,
  Stack,
  Alert,
  styled,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Link
} from '@mui/material';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Logo from '../components/Logo';
import { auth, db } from '../config/firebase';
import { AccountCircle, ContentCopy } from '@mui/icons-material';
import ConfirmDialog from '../components/ConfirmDialog';

// Custom styled buttons
const ActionButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  fontSize: '0.875rem',
  padding: '4px 12px',
  borderRadius: '4px',
  minWidth: 'auto'
}));

function ConfigWorkbench() {
  const { botId } = useParams();
  const [config, setConfig] = useState({
    roleDescription: '',
    instructions: '',
    exampleQuestions: '',
    name: '',
    userEmail: '',
    createdAt: '',
    changedAt: ''
  });
  const [message, setMessage] = useState('');
  const [assistants, setAssistants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false });
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Load assistants from Firebase configs collection
  const loadAssistants = useCallback(async () => {
    try {
      const configsRef = collection(db, 'configs');
      const snapshot = await getDocs(configsRef);
      const assistantsList = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt || new Date().toISOString(),
          changedAt: doc.data().changedAt || new Date().toISOString()
        }))
        .filter(assistant => assistant.userEmail === auth.currentUser?.email);
      
      const sortedAssistants = assistantsList.sort((a, b) => 
        new Date(b.changedAt) - new Date(a.changedAt)
      );
      
      setAssistants(sortedAssistants);
    } catch (error) {
      console.error('Error loading assistants:', error);
      setMessage('Error loading assistants: ' + error.message);
    }
  }, []);

  // Load specific config when botId changes
  useEffect(() => {
    const loadConfig = async () => {
      // Clear message when switching assistants
      setMessage('');
      
      if (botId && botId !== 'new') {
        setIsLoading(true);
        try {
          const docRef = doc(db, 'configs', botId);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setConfig({
              ...data,
              roleDescription: data.roleDescription || '',
              instructions: data.instructions || '',
              exampleQuestions: data.exampleQuestions || '',
              name: data.name || botId
            });
          } else {
            setMessage('Assistant not found');
            navigate('/config/new');
          }
        } catch (error) {
          setMessage('Error loading assistant: ' + error.message);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Clear form for new assistant
        setConfig({
          roleDescription: '',
          instructions: '',
          exampleQuestions: '',
          name: '',
          userEmail: auth.currentUser?.email || '',
          createdAt: new Date().toISOString(),
          changedAt: new Date().toISOString()
        });
      }
    };

    loadConfig();
  }, [botId, navigate]);

  // Initial load of assistants
  useEffect(() => {
    loadAssistants();
  }, [loadAssistants]);

  const handleSave = async () => {
    if (!config.name) {
      setMessage('Please enter a name for your assistant');
      return;
    }

    setIsLoading(true);
    try {
      const timestamp = new Date().toISOString();
      const configRef = doc(db, 'configs', botId === 'new' ? `config_${Date.now()}` : botId);
      
      await setDoc(configRef, {
        ...config,
        changedAt: timestamp,
        userEmail: auth.currentUser?.email
      });

      setMessage('Configuration saved successfully!');
      await loadAssistants();
      
      if (botId === 'new') {
        navigate(`/config/${configRef.id}`);
      }
    } catch (error) {
      setMessage('Error saving configuration: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAsNew = async () => {
    setIsLoading(true);
    try {
      const newId = `config_${Date.now()}`;
      const configRef = doc(db, 'configs', newId);
      
      // Create new config without publishId
      const newConfig = {
        ...config,
        publishId: null, // Reset publish state
        createdAt: new Date().toISOString(),
        changedAt: new Date().toISOString(),
        userEmail: auth.currentUser?.email
      };
      
      await setDoc(configRef, newConfig);

      // Update local state
      setConfig(newConfig);
      setMessage('New assistant created successfully!');
      await loadAssistants();
      navigate(`/config/${newId}`);
    } catch (error) {
      setMessage('Error creating new assistant: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Modified handleDelete with force delete option
  const handleDelete = async () => {
    if (!botId || botId === 'new') {
      setMessage('Cannot delete: No assistant selected');
      return;
    }

    try {
      if (window.confirm('Are you sure you want to delete this assistant?')) {
        setIsLoading(true);
        const docRef = doc(db, 'configs', botId);
        await deleteDoc(docRef);
        setMessage('Assistant deleted successfully');
        await loadAssistants();
        navigate('/config/new');
        
        // Clear the form using setConfig instead of setBotName
        setConfig({
          roleDescription: '',
          instructions: '',
          exampleQuestions: '',
          name: '',
          userEmail: auth.currentUser?.email || '',
          createdAt: new Date().toISOString(),
          changedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setMessage('Error deleting assistant: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      setMessage('Error signing out: ' + error.message);
    }
  };

  // Add new function to create URL-safe string
  const createUrlSafeId = (email, name) => {
    const username = email.split('@')[0]; // Remove email domain
    const safeName = name.toLowerCase()
      .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with dash
      .replace(/-+/g, '-') // Replace multiple dashes with single dash
      .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
    return `${username}-${safeName}`;
  };

  // Update handlePublish
  const handlePublish = async () => {
    if (!config.name) {
      setMessage('Please enter a name for your assistant');
      return;
    }

    setIsLoading(true);
    try {
      const timestamp = new Date().toISOString();
      const configRef = doc(db, 'configs', botId);
      
      // Create a consistent publishId if it doesn't exist
      const publishId = config.publishId || createUrlSafeId(auth.currentUser.email, config.name);
      
      const updatedConfig = {
        ...config,
        isActive: true,
        publishId: publishId,
        changedAt: timestamp
      };
      
      await setDoc(configRef, updatedConfig);
      setConfig(updatedConfig);

      // Use publishId in the URL
      const fullUrl = `${window.location.origin}/chat/${publishId}`;
      setMessage(
        <span>
          Assistant published! View at:{' '}
          <a 
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', fontWeight: 'bold' }}
          >
            {fullUrl}
          </a>
        </span>
      );

      await loadAssistants();
    } catch (error) {
      setMessage('Error publishing assistant: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Replace handleUnpublish with deactivate
  const handleUnpublish = async () => {
    setIsLoading(true);
    try {
      const configRef = doc(db, 'configs', botId);
      const updatedConfig = {
        ...config,
        isActive: false,
        changedAt: new Date().toISOString()
      };
      
      await setDoc(configRef, updatedConfig);
      setConfig(updatedConfig);
      setMessage('Assistant deactivated successfully');
      await loadAssistants();
    } catch (error) {
      setMessage('Error deactivating assistant: ' + error.message);
    } finally {
      setIsLoading(false);
      setConfirmDialog({ open: false });
    }
  };

  // Modify handleUnpublish to use confirmation
  const handleUnpublishClick = () => {
    setConfirmDialog({
      open: true,
      title: 'Unpublish Assistant',
      message: 'This will remove the public access to this assistant. Are you sure?',
      onConfirm: async () => {
        await handleUnpublish();
      },
      onCancel: () => setConfirmDialog({ open: false })
    });
  };

  // Add user menu handlers
  const handleUserMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  // Add account deletion handler
  const handleDeleteAccount = async () => {
    try {
      // Delete user's assistants
      const userAssistants = assistants.map(a => a.id);
      await Promise.all(userAssistants.map(id => 
        deleteDoc(doc(db, 'configs', id))
      ));

      // Delete user account
      await auth.currentUser.delete();
      
      // Sign out
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      setMessage('Error deleting account: ' + error.message);
    }
  };

  return (
    <Box sx={{ 
      display: 'flex',
      minHeight: '100vh',
      bgcolor: '#f8f9fa'
    }}>
      {/* Sidebar */}
      <Box 
        sx={{ 
          width: { xs: 0, md: 250 },
          display: { xs: 'none', md: 'block' },
          transition: 'width 0.3s ease',
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
          boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}
      >
        <Sidebar assistants={assistants} />
      </Box>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1 }}>
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
            {/* Left side: Logo and welcome message */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Logo size="small" />
              <Typography 
                variant="subtitle2" 
                color="text.secondary"
                sx={{ 
                  borderLeft: '1px solid #e0e0e0',
                  pl: 2,
                  display: { xs: 'none', sm: 'block' }
                }}
              >
                {auth.currentUser?.email}
              </Typography>
            </Box>

            {/* Center: Improvement link */}
            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="text"
                size="small"
                onClick={() => navigate('/improvement')}
                sx={{ 
                  color: '#F39C12',
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  '&:hover': {
                    backgroundColor: 'rgba(243, 156, 18, 0.08)'
                  }
                }}
              >
                Improvement & History
              </Button>
            </Box>
            
            {/* Right side: Action buttons */}
            <Stack direction="row" spacing={1}>
              <ActionButton
                variant="outlined"
                size="small"
                onClick={handleSave}
                disabled={isLoading}
              >
                Save
              </ActionButton>
              <ActionButton
                variant="outlined"
                size="small"
                onClick={handleSaveAsNew}
                disabled={isLoading}
              >
                Save as new
              </ActionButton>
              <ActionButton 
                variant="contained" 
                size="small"
                onClick={config.isActive ? handleUnpublishClick : handlePublish}
                disabled={!config.name || isLoading}
                sx={{ 
                  bgcolor: config.isActive ? '#d32f2f' : '#2E7D32', 
                  '&:hover': { 
                    bgcolor: config.isActive ? '#b71c1c' : '#1B5E20' 
                  }
                }}
              >
                {isLoading ? 'Processing...' : (config.isActive ? 'Unpublish' : 'Publish')}
              </ActionButton>
              <ActionButton 
                variant="outlined" 
                size="small"
                onClick={handleDelete}
                disabled={!botId || botId === 'new' || isLoading}
                sx={{ 
                  color: '#d32f2f', 
                  borderColor: '#d32f2f',
                  '&:hover': { 
                    bgcolor: 'rgba(211, 47, 47, 0.04)',
                    borderColor: '#b71c1c'
                  }
                }}
              >
                Delete
              </ActionButton>
              <IconButton
                size="small"
                onClick={handleUserMenuOpen}
                sx={{ ml: 1 }}
              >
                <AccountCircle />
              </IconButton>
            </Stack>
          </Toolbar>
        </AppBar>

        {/* Content */}
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Grid container spacing={3}>
            {message && (
              <Grid item xs={12}>
                <Alert 
                  severity="success" 
                  sx={{ 
                    mb: 2,
                    bgcolor: 'rgba(46, 125, 50, 0.05)',
                    '& .MuiAlert-message': { 
                      fontSize: '0.875rem',
                      '& a': {
                        textDecoration: 'underline',
                        '&:hover': {
                          textDecoration: 'none'
                        }
                      }
                    }
                  }}
                >
                  {message}
                </Alert>
              </Grid>
            )}

            {/* Modify the Published URL display section */}
            {config.isActive && config.publishId && (
              <Grid item xs={12}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 3, 
                    mb: 2,
                    bgcolor: 'background.default',
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography 
                      variant="subtitle2" 
                      sx={{ 
                        color: 'text.secondary',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Published URL:
                    </Typography>
                    <Box 
                      sx={{ 
                        flexGrow: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      <Link
                        href={`${window.location.origin}/chat/${config.publishId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          color: 'primary.main',
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline'
                          }
                        }}
                      >
                        {`${window.location.origin}/chat/${config.publishId}`}
                      </Link>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/chat/${config.publishId}`);
                        setMessage('URL copied to clipboard!');
                      }}
                      sx={{ 
                        color: 'text.secondary',
                        '&:hover': {
                          color: 'primary.main'
                        }
                      }}
                    >
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Box>
                </Paper>
              </Grid>
            )}

            <Grid item xs={12}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 3, 
                  mb: 2,
                  bgcolor: 'background.default',
                  borderRadius: 2
                }}
              >
                <Typography 
                  variant="h6" 
                  gutterBottom
                  sx={{ 
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: 'text.primary',
                    mb: 2
                  }}
                >
                  Assistant Name
                </Typography>
                <TextField
                  fullWidth
                  value={config.name}
                  onChange={(e) => setConfig({
                    ...config,
                    name: e.target.value
                  })}
                  placeholder="Enter a name for your assistant"
                  variant="standard"
                  sx={{ 
                    '& .MuiInput-root': {
                      fontSize: '0.875rem',
                      '&:before': {
                        borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
                      },
                      '&:hover:not(.Mui-disabled):before': {
                        borderBottom: '1px solid rgba(0, 0, 0, 0.2)'
                      }
                    }
                  }}
                />
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 3, 
                  mb: 2,
                  bgcolor: 'background.default',
                  borderRadius: 2
                }}
              >
                <Typography 
                  variant="h6" 
                  gutterBottom
                  sx={{ 
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: 'text.primary',
                    mb: 2
                  }}
                >
                  Role Description
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={config.roleDescription}
                  onChange={(e) => setConfig({
                    ...config,
                    roleDescription: e.target.value
                  })}
                  variant="standard"
                  placeholder="Describe the role and purpose of your assistant"
                  sx={{ 
                    '& .MuiInput-root': {
                      fontSize: '0.875rem',
                      '&:before': {
                        borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
                      },
                      '&:hover:not(.Mui-disabled):before': {
                        borderBottom: '1px solid rgba(0, 0, 0, 0.2)'
                      }
                    }
                  }}
                />
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 3, 
                  mb: 2,
                  bgcolor: 'background.default',
                  borderRadius: 2
                }}
              >
                <Typography 
                  variant="h6" 
                  gutterBottom
                  sx={{ 
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: 'text.primary',
                    mb: 2
                  }}
                >
                  Chatbot Instructions and Knowledge
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  value={config.instructions}
                  onChange={(e) => setConfig({
                    ...config,
                    instructions: e.target.value
                  })}
                  variant="standard"
                  placeholder="Enter chatbot instructions and knowledge"
                  sx={{ 
                    '& .MuiInput-root': {
                      fontSize: '0.875rem',
                      '&:before': {
                        borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
                      },
                      '&:hover:not(.Mui-disabled):before': {
                        borderBottom: '1px solid rgba(0, 0, 0, 0.2)'
                      }
                    }
                  }}
                />
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 3, 
                  mb: 2,
                  bgcolor: 'background.default',
                  borderRadius: 2
                }}
              >
                <Typography 
                  variant="h6" 
                  gutterBottom
                  sx={{ 
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: 'text.primary',
                    mb: 2
                  }}
                >
                  Example Questions and Answers for Assimilation
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  value={config.exampleQuestions}
                  onChange={(e) => setConfig({
                    ...config,
                    exampleQuestions: e.target.value
                  })}
                  variant="standard"
                  placeholder="Enter example questions and answers"
                  sx={{ 
                    '& .MuiInput-root': {
                      fontSize: '0.875rem',
                      '&:before': {
                        borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
                      },
                      '&:hover:not(.Mui-disabled):before': {
                        borderBottom: '1px solid rgba(0, 0, 0, 0.2)'
                      }
                    }
                  }}
                />
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Add the confirmation dialog */}
      <ConfirmDialog {...confirmDialog} />

      {/* Add user menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleUserMenuClose}
      >
        <MenuItem onClick={() => setDeleteDialogOpen(true)}>
          Delete Account
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          Sign Out
        </MenuItem>
      </Menu>

      {/* Delete Account Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Account</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete your account? This action cannot be undone.
            All your chatbots will be deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteAccount}
            color="error"
          >
            Delete Account
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ConfigWorkbench; 