import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Box, TextField, Button, Paper, Typography, Container, CircularProgress, IconButton } from '@mui/material';
import { ThumbUp, ThumbDown } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
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
  const [chatDocId, setChatDocId] = useState(null);

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
          content: 'Hei! Olen Airbnb-majoituksesi henkilökohtainen avustaja. Miten voin auttaa sinua?'
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

  // Save chat session if not already saved
  const saveChatSession = async () => {
    if (!chatDocId && messages.length > 1) {
      try {
        const chatDoc = await addDoc(collection(db, 'Airbnb_chathistory'), {
          publishId: config.publishId,
          botName: config.name,
          messages: messages.map((msg, index) => ({
            ...msg,
            messageId: `msg_${index}`,
            feedback: msg.feedback || null,
            feedbackComment: msg.feedbackComment || null
          })),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setChatDocId(chatDoc.id);
        return chatDoc.id; // Return the new ID
      } catch (error) {
        console.error('Error saving chat session:', error);
        return null;
      }
    } else if (chatDocId) {
      // Update existing chat session
      try {
        await updateDoc(doc(db, 'Airbnb_chathistory', chatDocId), {
          messages: messages.map((msg, index) => ({
            ...msg,
            messageId: `msg_${index}`,
            feedback: msg.feedback || null,
            feedbackComment: msg.feedbackComment || null
          })),
          updatedAt: serverTimestamp()
        });
        return chatDocId; // Return existing ID
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
      // If user provides empty comment, that's ok but let's store it as is
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
    
    // Save feedback to Firestore
    if (docId) {
      try {
        const messagesToSave = updatedMessages.map((msg, index) => ({
          ...msg,
          messageId: `msg_${index}`,
          feedback: msg.feedback || null,
          feedbackComment: msg.feedbackComment || null
        }));
        await updateDoc(doc(db, 'Airbnb_chathistory', docId), {
          messages: messagesToSave,
          updatedAt: serverTimestamp()
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

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // Removed old chatHistory storage - using Airbnb_chathistory instead


      // Filter out system messages after the first interaction
      const messagesToSend = messages.filter(msg => msg.role !== 'system').concat(userMessage);
      const response = await sendChatMessage(messagesToSend, config, chatId);
      const assistantContent = typeof response === 'string' ? response : response.text;
      const groundingMetadata = typeof response === 'object' ? response.groundingMetadata : null;
      
      const assistantMessage = { 
        role: 'assistant', 
        content: assistantContent,
        groundingMetadata: groundingMetadata
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Removed old chatHistory storage - using Airbnb_chathistory instead
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
      // Save chat session after message exchange
      saveChatSession();
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
            {messages.map((message, originalIndex) => {
              // Skip system messages in rendering
              if (message.role === 'system') return null;
              
              return (
              <Box 
                key={originalIndex}
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
                  {message.role === 'assistant' && (
                    <Box sx={{ mt: 1, display: 'flex', gap: 1, justifyContent: 'flex-start' }}>
                      <IconButton
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
              );
            })}
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