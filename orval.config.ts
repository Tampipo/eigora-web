import { defineConfig } from "orval";

export default defineConfig({
  physense: {
    input: {
      target:
        "https://raw.githubusercontent.com/Tampipo/physense-api/main/openapi.yaml",
    },
    output: {
      mode: "tags-split",
      target: "./lib/api/index.ts",
      schemas: "./lib/api/schemas",
      client: "fetch",
      baseUrl: "",
      clean: true,
      prettier: false,
      override: {
        mutator: {
          path: "./lib/http.ts",
          name: "customFetch",
        },
      },
    },
  },
});
