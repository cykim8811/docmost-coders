import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";

const envPath = path.resolve(process.cwd(), "..", "..");

export default defineConfig(({ mode }) => {
  const {
    APP_URL,
    FILE_UPLOAD_SIZE_LIMIT,
    FILE_IMPORT_SIZE_LIMIT,
    DRAWIO_URL,
    CLOUD,
    SUBDOMAIN_HOST,
    COLLAB_URL,
    BILLING_TRIAL_DAYS,
    POSTHOG_HOST,
    POSTHOG_KEY,
    AI_VECTOR_DRIVER,
    BETA_PUBLIC_SPACES,
  } = loadEnv(mode, envPath, "");

  return {
    define: {
      "process.env": {
        APP_URL,
        FILE_UPLOAD_SIZE_LIMIT,
        FILE_IMPORT_SIZE_LIMIT,
        DRAWIO_URL,
        CLOUD,
        SUBDOMAIN_HOST,
        COLLAB_URL,
        BILLING_TRIAL_DAYS,
        POSTHOG_HOST,
        POSTHOG_KEY,
        AI_VECTOR_DRIVER,
        BETA_PUBLIC_SPACES,
      },
      APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    plugins: [
      react(),
      {
        name: "coders-static-csp",
        transformIndexHtml(html) {
          return process.env.VITE_CODERS === "true"
            ? html.replace(/<link\s+rel="manifest"[^>]*>/g, "")
            : html;
        },
      },
    ],
    build: {
      ...(process.env.VITE_CODERS === "true" ? { assetsInlineLimit: 0 } : {}),
      rolldownOptions: {
        output: {
          advancedChunks: {
            groups: [
              {
                name: "vendor-mantine",
                test: /[\\/]node_modules[\\/]@mantine[\\/]/,
              },
            ],
          },
        },
      },
    },
    resolve: {
      alias: [
        ...(process.env.VITE_CODERS === "true"
          ? [
              {
                find: /.*excalidraw-view-lazy(?:\.tsx)?$/,
                replacement: path.resolve(
                  "src/community/diagram-placeholder.tsx",
                ),
              },
              {
                find: /.*excalidraw-menu-lazy(?:\.tsx)?$/,
                replacement: path.resolve("src/community/empty-view.tsx"),
              },
              {
                find: /.*code-block\/mermaid-view\.tsx$/,
                replacement: path.resolve("src/community/empty-view.tsx"),
              },
            ]
          : []),
        { find: "@", replacement: "/src" },
      ],
    },
    server: {
      proxy: {
        "/api": {
          target: APP_URL,
          changeOrigin: false,
        },
        "/socket.io": {
          target: APP_URL,
          ws: true,
          rewriteWsOrigin: true,
        },
        "/collab": {
          target: APP_URL,
          ws: true,
          rewriteWsOrigin: true,
        },
      },
    },
  };
});
