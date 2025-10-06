import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Box, TextField, Button, Paper, Typography, Container, CircularProgress, IconButton, Avatar, Chip } from '@mui/material';
import { ThumbUp, ThumbDown, Send as SendIcon, SmartToy, Person } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import Logo from '../components/Logo';
import { sendChatMessage } from '../services/openrouter';
import './ChatPage.css';

function ChatPage() {
  const params = useParams();
  const publishId = params.publishId;
  
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatDocId, setChatDocId] = useState(null);
  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
          content: systemPrompt,
          timestamp: new Date().toISOString()
        },
        {
          role: 'assistant',
          content: 'Hei! Olen Airbnb-majoituksesi henkilökohtainen avustaja. Miten voin auttaa sinua?',
          timestamp: new Date().toISOString()
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

  // Save chat session with structured data
  const saveChatSession = async () => {
    const messagesToSave = messages.filter(msg => msg.role !== 'system');
    
    if (!chatDocId && messagesToSave.length > 1) {
      try {
        // Header level data
        const chatDoc = await addDoc(collection(db, 'Airbnb_chathistory'), {
          // Header tiedot
          publishId: config.publishId,
          botName: config.name,
          user: 'anonymous', // Voit lisätä käyttäjätunnistuksen jos tarpeen
          sessionStarted: serverTimestamp(),
          lastUpdated: serverTimestamp(),
          
          // Viestit rivitasolla
          messages: messagesToSave.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            feedback: msg.feedback || null,
            feedbackComment: msg.feedbackComment || null,
            // API kutsu tiedot jos on assistant viesti
            ...(msg.role === 'assistant' && {
              apiCall: {
                model: 'x-ai/grok-4-fast',
                groundingMetadata: msg.groundingMetadata || null,
                isError: msg.isError || false
              }
            })
          }))
        });
        setChatDocId(chatDoc.id);
        return chatDoc.id;
      } catch (error) {
        console.error('Error saving chat session:', error);
        return null;
      }
    } else if (chatDocId) {
      try {
        await updateDoc(doc(db, 'Airbnb_chathistory', chatDocId), {
          lastUpdated: serverTimestamp(),
          messages: messagesToSave.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            feedback: msg.feedback || null,
            feedbackComment: msg.feedbackComment || null,
            // API kutsu tiedot jos on assistant viesti
            ...(msg.role === 'assistant' && {
              apiCall: {
                model: 'x-ai/grok-4-fast',
                groundingMetadata: msg.groundingMetadata || null,
                isError: msg.isError || false
              }
            })
          }))
        });
        return chatDocId;
      } catch (error) {
        console.error('Error updating chat session:', error);
        return null;
      }
    }
    return null;
  };

  // Handle feedback
  const handleFeedback = async (messageIndex, feedback) => {
    // Check if feedback already exists for this message
    if (messages[messageIndex].feedback) {
      alert('Olet jo antanut palautteen tälle vastaukselle.');
      return;
    }

    let feedbackComment = null;
    
    // If it's bad feedback, ask for a comment
    if (feedback === 'bad') {
      feedbackComment = prompt('Miksi vastaus oli huono? Kerro meille, jotta voimme parantaa assistenttia:');
      // If user cancels the prompt, don't proceed with feedback
      if (feedbackComment === null) {
        return;
      }
      if (feedbackComment === '') {
        feedbackComment = 'Ei kommenttia';
      }
    }

    const updatedMessages = [...messages];
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      feedback: feedback,
      feedbackComment: feedbackComment
    };
    setMessages(updatedMessages);

    // First ensure chat session is saved and get the ID
    let docId = chatDocId;
    if (!docId) {
      docId = await saveChatSession();
    }
    
    // Save feedback to Firestore with structured data
    if (docId) {
      try {
        const messagesToSave = updatedMessages.filter(msg => msg.role !== 'system');
        await updateDoc(doc(db, 'Airbnb_chathistory', docId), {
          lastUpdated: serverTimestamp(),
          // Päivitä viimeinen palaute header-tasolla
          lastFeedback: {
            type: feedback,
            comment: feedbackComment,
            timestamp: serverTimestamp()
          },
          messages: messagesToSave.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            feedback: msg.feedback || null,
            feedbackComment: msg.feedbackComment || null,
            // API kutsu tiedot jos on assistant viesti
            ...(msg.role === 'assistant' && {
              apiCall: {
                model: msg.model || 'x-ai/grok-4-fast',
                responseTime: msg.apiResponseTime || null,
                groundingMetadata: msg.groundingMetadata || null,
                isError: msg.isError || false
              }
            })
          }))
        });
      } catch (error) {
        console.error('Error saving feedback:', error);
      }
    } else {
      console.error('Could not save feedback - no document ID available');
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = { 
      role: 'user', 
      content: input,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    const apiStartTime = Date.now();
    
    try {
      // Filter out system messages for API call
      const messagesToSend = messages.filter(msg => msg.role !== 'system').concat(userMessage);
      const response = await sendChatMessage(messagesToSend, config, `chat_${Date.now()}`);
      const assistantContent = typeof response === 'string' ? response : response.text;
      const groundingMetadata = typeof response === 'object' ? response.groundingMetadata : null;
      
      const assistantMessage = {
        role: 'assistant',
        content: assistantContent,
        groundingMetadata: groundingMetadata,
        timestamp: new Date().toISOString(),
        apiResponseTime: Date.now() - apiStartTime,
        model: response.model || 'x-ai/grok-4-fast'
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Error:', error);
      const errorMessage = {
        role: 'assistant',
        content: `Virhe: ${error.message}\n\nTarkista että:\n1. OpenRouter API-avain on asetettu .env tiedostoon\n2. Sovellus on käynnistetty uudelleen .env muutosten jälkeen\n3. API-avain on oikea (VITE_OPEN_ROUTER_API_KEY tai REACT_APP_OPEN_ROUTER_API_KEY)`,
        timestamp: new Date().toISOString(),
        isError: true,
        apiResponseTime: Date.now() - apiStartTime,
        model: 'x-ai/grok-4-fast'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      await saveChatSession();
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Container maxWidth="md" sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 2 }}>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo />
          <Chip 
            icon={<SmartToy />}
            label={config.name}
            sx={{ 
              bgcolor: 'white',
              fontWeight: 'bold',
              fontSize: { xs: '0.9rem', sm: '1rem' }
            }}
          />
        </Box>
        <Paper 
          elevation={6} 
          sx={{ 
            flex: 1,
            display: 'flex', 
            flexDirection: 'column',
            bgcolor: 'white',
            borderRadius: 3,
            overflow: 'hidden'
          }}
        >

          {/* Messages Area */}
          <Box 
            className="chat-messages-container"
            sx={{ 
              flexGrow: 1, 
              overflowY: 'auto',
              p: 2,
              bgcolor: '#f8f9fa',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {messages.map((message, originalIndex) => {
              // Skip system messages in rendering
              if (message.role === 'system') return null;
              
              return (
              <Box 
                key={originalIndex}
                className="chat-message"
                sx={{
                  mb: 3,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  flexDirection: message.role === 'user' ? 'row-reverse' : 'row'
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: message.role === 'user' ? '#667eea' : '#764ba2',
                    width: 36,
                    height: 36
                  }}
                >
                  {message.role === 'user' ? <Person /> : <SmartToy />}
                </Avatar>
                <Box sx={{ maxWidth: '70%' }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'text.secondary',
                      ml: message.role === 'user' ? 'auto' : 0,
                      mr: message.role === 'user' ? 0 : 'auto',
                      display: 'block',
                      mb: 0.5,
                      textAlign: message.role === 'user' ? 'right' : 'left'
                    }}
                  >
                    {message.role === 'user' ? 'Sinä' : config.name}
                    {message.timestamp && ` • ${new Date(message.timestamp).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}`}
                  </Typography>
                  <Paper
                    className="chat-message-paper"
                    elevation={message.isError ? 0 : 1}
                    sx={{
                      p: 2,
                      bgcolor: message.isError ? '#ffebee' : (message.role === 'user' ? '#667eea' : 'white'),
                      color: message.isError ? '#c62828' : (message.role === 'user' ? 'white' : 'text.primary'),
                      borderRadius: 2,
                      border: message.isError ? '1px solid #ffcdd2' : 'none'
                    }}
                  >
                  <ReactMarkdown
                    components={{
                      // Custom styles for Markdown elements
                      h1: ({children}) => <Typography variant="h5" sx={{mb: 1, fontWeight: 'bold'}}>{children}</Typography>,
                      h2: ({children}) => <Typography variant="h6" sx={{mb: 1, fontWeight: 'bold'}}>{children}</Typography>,
                      h3: ({children}) => <Typography variant="subtitle1" sx={{mb: 1, fontWeight: 'bold'}}>{children}</Typography>,
                      p: ({children}) => <Typography sx={{mb: 1}}>{children}</Typography>,
                      strong: ({children}) => <Typography component="span" sx={{fontWeight: 'bold'}}>{children}</Typography>,
                      em: ({children}) => <Typography component="span" sx={{fontStyle: 'italic'}}>{children}</Typography>,
                      ul: ({children}) => <Box component="ul" sx={{pl: 2, mb: 1}}>{children}</Box>,
                      ol: ({children}) => <Box component="ol" sx={{pl: 2, mb: 1}}>{children}</Box>,
                      li: ({children}) => <Typography component="li" sx={{mb: 0.5}}>{children}</Typography>,
                      a: ({href, children}) => (
                        <Typography 
                          component="a" 
                          href={href} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          sx={{
                            color: 'primary.main',
                            textDecoration: 'underline',
                            '&:hover': { textDecoration: 'none' }
                          }}
                        >
                          {children}
                        </Typography>
                      )
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  {/* Display grounding links if available */}
                  {message.groundingMetadata && message.groundingMetadata.webSearchQueries && (
                    <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                        Hakusanat:
                      </Typography>
                      {message.groundingMetadata.webSearchQueries.map((query, idx) => (
                        <Typography key={idx} variant="caption" sx={{ display: 'block', ml: 1 }}>
                          • {query}
                        </Typography>
                      ))}
                      {/* Parse links from searchEntryPoint HTML */}
                      {message.groundingMetadata.searchEntryPoint && (() => {
                        const htmlContent = message.groundingMetadata.searchEntryPoint.renderedContent;
                        const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
                        const links = [];
                        let match;
                        while ((match = linkRegex.exec(htmlContent)) !== null) {
                          links.push({ url: match[1], text: match[2] });
                        }
                        return links.length > 0 && (
                          <>
                            <Typography variant="caption" sx={{ display: 'block', mb: 0.5, mt: 1 }}>
                              Google-hakutulokset:
                            </Typography>
                            {links.map((link, idx) => (
                              <Button
                                key={idx}
                                size="small"
                                variant="text"
                                href={link.url}
                                target="_blank"
                                sx={{ fontSize: '0.8rem', p: 0.5, display: 'block', textAlign: 'left' }}
                              >
                                {link.text}
                              </Button>
                            ))}
                          </>
                        );
                      })()}
                    </Box>
                  )}
                  {/* Feedback buttons for assistant messages */}
                  {message.role === 'assistant' && !message.isError && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: 1, alignItems: 'center' }}>
                      <IconButton
                        className="feedback-button"
                        size="small"
                        onClick={() => handleFeedback(originalIndex, 'good')}
                        disabled={message.feedback !== undefined}
                        sx={{ 
                          color: message.feedback === 'good' ? '#4CAF50' : (message.feedback ? '#ccc' : 'text.secondary'),
                          bgcolor: message.feedback === 'good' ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                          border: message.feedback === 'good' ? '2px solid #4CAF50' : 'none',
                          '&:hover': { 
                            bgcolor: message.feedback ? 'transparent' : 'rgba(76, 175, 80, 0.1)', 
                            color: message.feedback ? (message.feedback === 'good' ? '#4CAF50' : '#ccc') : '#4CAF50'
                          },
                          '&.Mui-disabled': {
                            color: message.feedback === 'good' ? '#4CAF50' : '#ccc'
                          }
                        }}
                      >
                        <ThumbUp fontSize="small" />
                      </IconButton>
                      <IconButton
                        className="feedback-button"
                        size="small"
                        onClick={() => handleFeedback(originalIndex, 'bad')}
                        disabled={message.feedback !== undefined}
                        sx={{ 
                          color: message.feedback === 'bad' ? '#f44336' : (message.feedback ? '#ccc' : 'text.secondary'),
                          bgcolor: message.feedback === 'bad' ? 'rgba(244, 67, 54, 0.1)' : 'transparent',
                          border: message.feedback === 'bad' ? '2px solid #f44336' : 'none',
                          '&:hover': { 
                            bgcolor: message.feedback ? 'transparent' : 'rgba(244, 67, 54, 0.1)', 
                            color: message.feedback ? (message.feedback === 'bad' ? '#f44336' : '#ccc') : '#f44336'
                          },
                          '&.Mui-disabled': {
                            color: message.feedback === 'bad' ? '#f44336' : '#ccc'
                          }
                        }}
                      >
                        <ThumbDown fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Paper>
                </Box>
              </Box>
              );
            })}
            {/* Typing indicator */}
            {isProcessing && (
              <Box 
                className="chat-message"
                sx={{
                  mb: 3,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: '#764ba2',
                    width: 36,
                    height: 36
                  }}
                >
                  <SmartToy />
                </Avatar>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'text.secondary',
                      display: 'block',
                      mb: 0.5
                    }}
                  >
                    {config.name}
                  </Typography>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      bgcolor: 'white',
                      borderRadius: 2
                    }}
                  >
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </Paper>
                </Box>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input Area */}
          <Box sx={{ 
            p: 2, 
            bgcolor: 'white',
            borderTop: '1px solid rgba(0,0,0,0.1)'
          }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                fullWidth
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Kirjoita viestisi..."
                variant="outlined"
                disabled={isProcessing}
                multiline
                maxRows={4}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: '#f8f9fa'
                  }
                }}
              />
              <IconButton
                className={input.trim() && !isProcessing ? 'send-button-ready' : ''}
                color="primary"
                onClick={handleSendMessage}
                disabled={!input.trim() || isProcessing}
                sx={{ 
                  bgcolor: '#667eea',
                  color: 'white',
                  '&:hover': { bgcolor: '#5a67d8' },
                  '&.Mui-disabled': { bgcolor: '#e0e0e0' }
                }}
              >
                {isProcessing ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
              </IconButton>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default ChatPage; 