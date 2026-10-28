import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : '/battleship-bonanza/',
  define: { __BUILD__: JSON.stringify(process.env.GITHUB_SHA ?? Date.now().toString(36)) },
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: { output: { advancedChunks: { groups: [{ name: 'three', test: /node_modules[\\/]three/ }] } } },
  },
}));
