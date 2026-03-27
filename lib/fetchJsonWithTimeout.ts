type FetchJsonOptions = Omit<RequestInit, "signal"> & {
  timeoutMs?: number;
};

export async function fetchJsonWithTimeout<T>(
  input: string | URL,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { timeoutMs = 15000, ...init } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    const text = await response.text();
    let json: unknown = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Expected JSON response from ${String(input)}`);
    }

    if (!response.ok) {
      const detail =
        json && typeof json === "object" && "error" in json && typeof json.error === "string"
          ? `: ${json.error}`
          : "";
      throw new Error(`Request failed (${response.status})${detail}`);
    }

    return json as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
