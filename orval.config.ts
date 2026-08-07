// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { defineConfig } from "orval";

export default defineConfig({
  eigora: {
    input: {
      target:
        "https://raw.githubusercontent.com/Tampipo/eigora-api/main/openapi.yaml",
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
