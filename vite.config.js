import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "/plam-plan/",
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "firebase-firestore",
              test: /node_modules[\\/]@firebase[\\/]firestore/,
            },
            {
              name: "firebase-auth",
              test: /node_modules[\\/]@firebase[\\/]auth/,
            },
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: { include: ["tests/**/*.test.js"], exclude: ["tests/rules.test.js"] },
});
