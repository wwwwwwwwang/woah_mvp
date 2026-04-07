const DEFAULT_USER_AGENT =
  "WOAH-MVP/0.1 (+https://localhost; research prototype for pathogen surveillance)";

export async function fetchText(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
      Accept: "text/html,application/json,text/plain,*/*",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} (${url})`);
  }

  return response.text();
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
      Accept: "application/json,text/plain,*/*",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} (${url})`);
  }

  return response.json() as Promise<T>;
}

export async function fetchArrayBuffer(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
      Accept: "*/*",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} (${url})`);
  }

  return response.arrayBuffer();
}
