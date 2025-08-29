// Validate OpenAI configuration
if (!process.env.REACT_APP_OPENAI_API_KEY) {
  console.error('OpenAI API key is missing. Please check your .env file.');
}

export const OPENAI_CONFIG = {
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  model: 'gpt-4'  // Use exact model name
}; 