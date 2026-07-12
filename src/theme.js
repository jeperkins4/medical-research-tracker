import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: '#2563eb' },  // matches existing dominant blue, App.css
    secondary: { main: '#7c3aed' },
    success:   { main: '#10b981' },
    error:     { main: '#ef4444' },
    warning:   { main: '#f59e0b' },
    info:      { main: '#3b82f6' },
    text: {
      primary: '#1f2937',
      secondary: '#6b7280',   // passes 4.5:1 on white per audit — use this instead of #9ca3af for body text
    },
    background: {
      default: '#f5f5f5',   // matches App.css's existing body background — CssBaseline would otherwise reset it to white
    },
  },
  spacing: 8, // establishes a real 8px grid, replacing the 16-value ad hoc scale
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontSize: '2rem' },      // 32px
    h2: { fontSize: '1.5rem' },    // 24px
    h3: { fontSize: '1.25rem' },   // 20px
    body1: { fontSize: '1rem' },   // 16px
    body2: { fontSize: '0.875rem' }, // 14px
    caption: { fontSize: '0.75rem' }, // 12px
  },
});

export default theme;
