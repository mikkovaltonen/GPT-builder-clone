import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './config/firebase'; // Import firebase initialization
import './index.css';
import App from './App';

// Add environment variable check at the top
const initializeEnv = () => {
  const openaiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  if (!openaiKey) {
    console.warn('OpenAI API key not found in environment variables');
  }

  // Make environment variables available globally
  window._env_ = {
    REACT_APP_OPENAI_API_KEY: openaiKey,
    REACT_APP_OPENAI_MODEL: process.env.REACT_APP_OPENAI_MODEL || 'gpt-4'
  };
};

initializeEnv();

// Configure future flags for React Router
const router = {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter {...router}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
); 