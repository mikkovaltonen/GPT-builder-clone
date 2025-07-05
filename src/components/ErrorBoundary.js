import React from 'react';
import { Alert, AlertTitle, Box, Button } from '@mui/material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            <AlertTitle>Virhe</AlertTitle>
            <p>Jotain meni pieleen. Tarkista seuraavat asiat:</p>
            <ul>
              <li>Onko Gemini API-avain asetettu .env.local tiedostoon?</li>
              <li>Onko API-avain oikein? (REACT_APP_GEMINI_API_KEY)</li>
              <li>Onko sovellus käynnistetty uudelleen .env muutosten jälkeen?</li>
            </ul>
            <Box sx={{ mt: 2 }}>
              <Button onClick={() => window.location.reload()}>
                Lataa sivu uudelleen
              </Button>
            </Box>
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;