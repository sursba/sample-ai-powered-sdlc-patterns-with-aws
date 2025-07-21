import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          swagger: ['swagger-ui-react']
        }
      }
    }
  },
  define: {
    // Ensure environment variables are available at build time
    'process.env.REACT_APP_AWS_REGION': JSON.stringify(process.env.REACT_APP_AWS_REGION),
    'process.env.REACT_APP_USER_POOL_ID': JSON.stringify(process.env.REACT_APP_USER_POOL_ID),
    'process.env.REACT_APP_USER_POOL_CLIENT_ID': JSON.stringify(process.env.REACT_APP_USER_POOL_CLIENT_ID),
    'process.env.REACT_APP_AUTH_DOMAIN': JSON.stringify(process.env.REACT_APP_AUTH_DOMAIN),
    'process.env.REACT_APP_DOMAIN_ANALYZER_FUNCTION': JSON.stringify(process.env.REACT_APP_DOMAIN_ANALYZER_FUNCTION),
    'process.env.REACT_APP_DOC_GENERATOR_FUNCTION': JSON.stringify(process.env.REACT_APP_DOC_GENERATOR_FUNCTION)
  }
});