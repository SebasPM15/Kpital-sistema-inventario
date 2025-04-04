import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'
import './index.css'

// Wrap in IIFE for cleaner scope and error handling
(() => {
  try {
    const rootElement = document.getElementById('root');
    
    if (!rootElement) {
      throw new Error('Failed to find the root element. Check your HTML.');
    }
    
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    
    console.info('Application initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    // Could display a fallback UI for critical errors
  }
})();
