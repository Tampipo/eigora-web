// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

const DEFAULT_BASE_URL = "https://api.eigora.tampipo.fr";

function getBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL;
  return (fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
}

// orval `client: "fetch"` mutator contract:
// must return Promise<TData> where TData is the response union the codegen
// constructs (i.e. { data, status, headers } discriminated by status).
export async function customFetch<TData>(
  url: string,
  init: RequestInit,
): Promise<TData> {
  const target = /^https?:\/\//.test(url) ? url : `${getBaseUrl()}${url}`;

  const res = await fetch(target, init);
  const body = [204, 205, 304].includes(res.status) ? null : await res.text();
  const data = body ? JSON.parse(body) : {};

  return { data, status: res.status, headers: res.headers } as TData;
}

export default customFetch;
