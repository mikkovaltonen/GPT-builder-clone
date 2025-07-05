import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY || 
                window.REACT_APP_GEMINI_API_KEY || 
                localStorage.getItem('GEMINI_API_KEY');

const MODEL_NAME = process.env.REACT_APP_GEMINI_MODEL;

console.log('Gemini API Key:', API_KEY ? `${API_KEY.substring(0, 10)}...` : 'Not found');

let genAI = null;
let model = null;

if (API_KEY && MODEL_NAME) {
  genAI = new GoogleGenerativeAI(API_KEY);
  model = genAI.getGenerativeModel({ model: MODEL_NAME });
  console.log('Gemini model initialized:', MODEL_NAME);
} else if (!MODEL_NAME) {
  console.error('Gemini model not configured. Please set REACT_APP_GEMINI_MODEL in .env');
}

export const sendChatMessage = async (messages) => {
  if (!model) {
    throw new Error('Gemini API key or model not configured');
  }

  try {
    console.log('Sending request to Gemini with messages:', messages);
    
    // Convert OpenAI format to Gemini format
    const history = [];
    let currentPrompt = '';
    
    messages.forEach((msg, index) => {
      if (msg.role === 'system') {
        // Add system message as the first user message
        if (index === 0) {
          currentPrompt = msg.content + '\n\n';
        }
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

    // Start chat with history
    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        topP: 0.8,
        topK: 10
      },
    });

    const result = await chat.sendMessage(currentPrompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini response received:', text.substring(0, 100) + '...');
    
    return text;
  } catch (error) {
    console.error('Gemini Service Error:', error);
    throw error;
  }
};

export default {
  sendChatMessage
};