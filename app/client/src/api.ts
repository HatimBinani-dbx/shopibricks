export class ApiError extends Error {
  constructor(message: string, public code?: string, public status?: number) {super(message);}
}
export async function api<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(url, {method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? undefined : {'Content-Type': 'application/json', ...headers}, body: body === undefined ? undefined : JSON.stringify(body)});
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.error?.message || data.message || `Request failed (${response.status})`, data.error?.code || data.code, response.status);
  return data;
}
export const post = <T,>(url: string, body: unknown) => api<T>(url, body, {'Idempotency-Key': crypto.randomUUID(), 'Request-Id': crypto.randomUUID()});
