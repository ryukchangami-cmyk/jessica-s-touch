// @lovable.dev/vite-tanstack-config already includes nitro internally.
// Use the `nitro` option to override the preset — do NOT add a second nitro plugin.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel",
  },
});
