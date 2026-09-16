import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // Allow ngrok tunnels and external mobile devices
    allowedHosts: true,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  }
});
