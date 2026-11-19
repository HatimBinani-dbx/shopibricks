export class ApiError extends Error {
  constructor(message: string, public code?: string, public status?: number) {super(message);}
}
// Optional interceptor (presenter fallback mode): returns a promise to answer locally, or undefined to go to the network.
type Interceptor = (url: string, body?: unknown) => Promise<unknown> | undefined;
let interceptor: Interceptor | null = null;
export const setInterceptor = (fn: Interceptor | null) => { interceptor = fn; };
export async function api<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const local = interceptor?.(url, body);
  if (local) return local as Promise<T>;
  const response = await fetch(url, {method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? undefined : {'Content-Type': 'application/json', ...headers}, body: body === undefined ? undefined : JSON.stringify(body)});
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.error?.message || data.message || `Request failed (${response.status})`, data.error?.code || data.code, response.status);
  return data;
}
export const post = <T,>(url: string, body: unknown) => api<T>(url, body, {'Idempotency-Key': crypto.randomUUID(), 'Request-Id': crypto.randomUUID()});
