import { defineConfig } from "vite";

export default defineConfig({
  define: {
    CANVAS_RENDERER: true,
    WEBGL_RENDERER: true
  }
});
