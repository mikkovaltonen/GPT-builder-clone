import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Box, TextField, Button, Paper, Typography, Container, CircularProgress } from '@mui/material';
import Logo from '../components/Logo';
import { sendChatMessage } from '../services/gemini';

function ChatPage() {
  const params = useParams();
  const publishId = params.publishId;
  
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatId] = useState(`chat_${Date.now()}`);

  // Initialize chat with combined instructions
  useEffect(() => {
    const initializeChat = async () => {
      if (!config) return;

      // Combine role description and instructions
      const systemPrompt = `
${config.roleDescription}

Instructions and Knowledge:
${config.instructions}

Example Q&A:
${config.exampleQuestions}
`;

      setMessages([
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'assistant',
          content: 'Hei! Miten voin auttaa?'
        }
      ]);
    };

    initializeChat();
  }, [config]);

  // Fetch config
  useEffect(() => {
    const fetchConfig = async () => {
      if (!publishId) {
        setError('No bot ID provided');
        setLoading(false);
        return;
      }

      try {
        const configsRef = collection(db, 'configs');
        const q = query(configsRef, where('publishId', '==', publishId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const botConfig = querySnapshot.docs[0].data();
          if (botConfig.isActive) {
            setConfig(botConfig);
          } else {
            setError('This chatbot is not currently active');
          }
        } else {
          setError('Chatbot not found');
        }
      } catch (error) {
        console.error("Detailed error:", error);
        // Provide more specific error message
        if (error.code === 'permission-denied') {
          setError('Permission denied. Please check Firebase rules.');
        } else if (error.code === 'unavailable') {
          setError('Service unavailable. Please check your internet connection.');
        } else {
          setError(`Error loading chatbot: ${error.message || 'Unknown error'}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [publishId]);

  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // Store user message in nested structure
      await addDoc(
        collection(db, 'chatHistory', chatId, 'messages'), 
        {
          botId: config.publishId,
          sender: 'user',
          content: input,
          timestamp: serverTimestamp()
        }
      );

      // Use the OpenAI service instead of direct fetch
      console.log('OpenAI Request:', {
        model: "gpt-3.5-turbo",
        messages: messages.concat(userMessage)
      });

      const assistantContent = await sendChatMessage(messages.concat(userMessage), config);
      const assistantMessage = { role: 'assistant', content: assistantContent };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Store assistant response
      await addDoc(
        collection(db, 'chatHistory', chatId, 'messages'),
        {
          botId: config.publishId,
          sender: 'assistant',
          content: assistantContent,
          timestamp: serverTimestamp()
        }
      );

      console.log('Gemini Response:', {
        assistantContent: assistantContent
      });
    } catch (error) {
      console.error('AI Error:', error);
      const errorMessage = {
        role: 'assistant',
        content: `Virhe: ${error.message}\n\nTarkista että:\n1. Gemini API-avain on asetettu .env.local tiedostoon\n2. Sovellus on käynnistetty uudelleen .env muutosten jälkeen\n3. API-avain on oikea (REACT_APP_GEMINI_API_KEY)`
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Store error message in nested structure
      await addDoc(
        collection(db, 'chatHistory', chatId, 'messages'),
        {
          botId: config.publishId,
          sender: 'assistant',
          content: errorMessage.content,
          timestamp: serverTimestamp()
        }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading chatbot: {error}</div>;
  if (!config) return <div>Chatbot not found</div>;

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        height: '100vh',
        background: 'linear-gradient(to bottom, #f5f5f5, #e0e0e0)',
        py: { xs: 1, sm: 2 },
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Container maxWidth="md" sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: { xs: 1, sm: 2 } }}>
        <Box sx={{ mb: { xs: 1, sm: 2 }, display: 'flex', justifyContent: 'center' }}>
          <Logo />
        </Box>
        <Paper 
          elevation={3} 
          sx={{ 
            p: { xs: 1, sm: 2 }, 
            flex: 1,
            display: 'flex', 
            flexDirection: 'column',
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: 2,
            maxHeight: 'calc(100vh - 80px)',
            overflow: 'hidden'
          }}
        >
          {/* Chat Header */}
          <Typography variant="h6" gutterBottom sx={{ textAlign: 'center', fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
            {config.name}
          </Typography>

          {/* Messages Area */}
          <Box sx={{ 
            flexGrow: 1, 
            overflowY: 'auto', 
            mb: { xs: 1, sm: 2 },
            p: { xs: 1, sm: 2 },
            borderRadius: 1,
            WebkitOverflowScrolling: 'touch'
          }}>
            {messages.filter(m => m.role !== 'system').map((message, index) => (
              <Box 
                key={index}
                sx={{
                  mb: 2,
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <Paper
                  elevation={1}
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    maxWidth: { xs: '85%', sm: '70%' },
                    bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper',
                    color: message.role === 'user' ? 'white' : 'text.primary',
                    fontSize: { xs: '0.9rem', sm: '1rem' }
                  }}
                >
                  <Typography>{message.content}</Typography>
                </Paper>
              </Box>
            ))}
          </Box>

          {/* Input Area */}
          <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField
              fullWidth
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Type your message..."
              variant="outlined"
              size="small"
              disabled={isProcessing}
              multiline
              maxRows={3}
              sx={{
                fontSize: { xs: '0.9rem', sm: '1rem' },
                '& .MuiOutlinedInput-root': {
                  fontSize: { xs: '0.9rem', sm: '1rem' }
                }
              }}
            />
            <Button 
              variant="contained" 
              onClick={handleSendMessage}
              disabled={!input.trim() || isProcessing}
              endIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : null}
              sx={{ 
                minWidth: { xs: '100%', sm: 'auto' },
                fontSize: { xs: '0.9rem', sm: '1rem' }
              }}
            >
              Send
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default ChatPage; 