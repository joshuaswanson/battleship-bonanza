import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : '/battleship-bonanza/',
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: { output: { advancedChunks: { groups: [{ name: 'three', test: /node_modules[\\/]three/ }] } } },
  },
}));
