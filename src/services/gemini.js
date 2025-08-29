import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY || 
                window.REACT_APP_GEMINI_API_KEY || 
                localStorage.getItem('GEMINI_API_KEY');

const MODEL_NAME = process.env.REACT_APP_GEMINI_MODEL || 
                   window.REACT_APP_GEMINI_MODEL || 
                   localStorage.getItem('GEMINI_MODEL') || 
                   'gemini-2.0-flash-exp';

console.log('Gemini API Key:', API_KEY ? `${API_KEY.substring(0, 10)}...` : 'Not found');
console.log('Gemini Model from env:', process.env.REACT_APP_GEMINI_MODEL || 'Not set');
console.log('Gemini Model being used:', MODEL_NAME);

let genAI = null;
let model = null;

if (API_KEY && MODEL_NAME) {
  genAI = new GoogleGenerativeAI(API_KEY);
  model = genAI.getGenerativeModel({ 
    model: MODEL_NAME,
    tools: [{
      googleSearch: {}
    }]
  });
  console.log('Gemini model initialized:', MODEL_NAME, 'with Google Search grounding');
  console.log('Model configuration:', {
    model: MODEL_NAME,
    temperature: 0.3,
    topP: 0.8,
    topK: 10,
    maxOutputTokens: 2048
  });
} else if (!MODEL_NAME) {
  console.error('Gemini model not configured. Please set REACT_APP_GEMINI_MODEL in .env');
}

// Store system context for the session - use Map to store per chat
const systemContextMap = new Map();

export const setSystemContext = (chatId, context) => {
  systemContextMap.set(chatId, context);
};

export const sendChatMessage = async (messages, config, chatId = 'default') => {
  if (!model) {
    throw new Error('Gemini API key or model not configured');
  }

  try {
    console.log('Sending request to Gemini with messages:', messages);
    
    // Get or set system context for this chat
    let systemContext = systemContextMap.get(chatId);
    
    // Set system context from config if not already set
    if (config && config.roleDescription && !systemContext) {
      systemContext = `${config.roleDescription}\n\nInstructions and Knowledge:\n${config.instructions}\n\nExample Q&A:\n${config.exampleQuestions}`;
      systemContextMap.set(chatId, systemContext);
      console.log('System context initialized for chat:', chatId, {
        contextLength: systemContext.length,
        preview: systemContext.substring(0, 200) + '...'
      });
    }
    
    // Convert OpenAI format to Gemini format
    const history = [];
    let currentPrompt = '';
    
    messages.forEach((msg, index) => {
      if (msg.role === 'system') {
        // Skip system messages as we handle them separately
        return;
      } else if (msg.role === 'user') {
        if (index === messages.length - 1) {
          // Last user message becomes the prompt
          currentPrompt += msg.content;
        } else {
          history.push({
            role: 'user',
            parts: [{ text: msg.content }]
          });
        }
      } else if (msg.role === 'assistant') {
        // Only add assistant messages to history if there's already a user message
        if (history.length > 0 || messages.some((m, i) => m.role === 'user' && i < index)) {
          history.push({
            role: 'model',
            parts: [{ text: msg.content }]
          });
        }
      }
    });

    // Always prepend system context to the current prompt if available
    const chatHistory = [...history];
    if (systemContext && currentPrompt) {
      currentPrompt = systemContext + '\n\n' + currentPrompt;
      console.log('Including system context in prompt for chat:', chatId);
    }
    
    // Start chat with history
    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.3,
        topP: 0.8,
        topK: 10
      },
    });

    const result = await chat.sendMessage(currentPrompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract grounding metadata if available
    let groundingMetadata = null;
    if (response.candidates && response.candidates[0]) {
      groundingMetadata = response.candidates[0].groundingMetadata;
      if (groundingMetadata) {
        console.log('Grounding metadata found:', JSON.stringify(groundingMetadata, null, 2));
      }
    }
    
    console.log('Gemini response received:', text.substring(0, 100) + '...');
    
    // Return both text and metadata
    return {
      text: text,
      groundingMetadata: groundingMetadata
    };
  } catch (error) {
    console.error('Gemini Service Error:', error);
    throw error;
  }
};

const geminiService = {
  sendChatMessage,
  setSystemContext
};

export default geminiService;