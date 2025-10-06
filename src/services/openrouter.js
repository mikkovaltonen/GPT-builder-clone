const API_KEY = process.env.REACT_APP_OPEN_ROUTER_API_KEY ||
                process.env.VITE_OPEN_ROUTER_API_KEY ||
                window.REACT_APP_OPEN_ROUTER_API_KEY ||
                window.VITE_OPEN_ROUTER_API_KEY ||
                localStorage.getItem('OPEN_ROUTER_API_KEY');

const MODEL_NAME = 'x-ai/grok-4-fast';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Remove console logs in production
if (process.env.NODE_ENV === 'development') {
  console.log('OpenRouter API Key:', API_KEY ? 'Configured' : 'Not found');
  console.log('OpenRouter Model:', MODEL_NAME);
}

// Store system context for the session - use Map to store per chat
const systemContextMap = new Map();

export const setSystemContext = (chatId, context) => {
  systemContextMap.set(chatId, context);
};

export const sendChatMessage = async (messages, config, chatId = 'default') => {
  if (!API_KEY) {
    throw new Error('OpenRouter API key not configured. Please set REACT_APP_OPEN_ROUTER_API_KEY in .env');
  }

  try {
    // Log only in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Sending request to OpenRouter');
    }

    // Get system context for this chat (should be set at initialization)
    const systemContext = systemContextMap.get(chatId);

    if (!systemContext) {
      console.warn('System context not found for chat:', chatId);
    }

    // Convert messages to OpenRouter format
    const formattedMessages = [];

    // Add system message if we have context
    if (systemContext) {
      formattedMessages.push({
        role: 'system',
        content: systemContext
      });
    }

    // Add conversation messages (filter out system messages from input)
    messages.forEach(msg => {
      if (msg.role !== 'system') {
        formattedMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      }
    });


    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': config?.name || 'AI Assistant'
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: formattedMessages,
        temperature: 0.3,
        max_tokens: 2048,
        top_p: 0.8,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter API Error:', errorData);
      throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      const text = data.choices[0].message.content;

      // Return response with metadata
      return {
        text: text,
        model: data.model || MODEL_NAME,
        usage: data.usage || null
      };
    } else {
      throw new Error('Unexpected response format from OpenRouter');
    }
  } catch (error) {
    console.error('OpenRouter Service Error:', error);
    throw error;
  }
};

const openrouterService = {
  sendChatMessage,
  setSystemContext
};

export default openrouterService;