import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : '/battleship-bonanza/',
  build: { chunkSizeWarningLimit: 1200 },
}));
