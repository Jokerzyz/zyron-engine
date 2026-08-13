import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        guide: resolve(import.meta.dirname, 'guide.html'),
        imageToAscii: resolve(import.meta.dirname, 'image-to-ascii.html'),
        videoToAscii: resolve(import.meta.dirname, 'video-to-ascii.html'),
        ditherImage: resolve(import.meta.dirname, 'dither-image.html'),
        glassmorphismGenerator: resolve(import.meta.dirname, 'glassmorphism-generator.html'),
      },
    },
  },
});
