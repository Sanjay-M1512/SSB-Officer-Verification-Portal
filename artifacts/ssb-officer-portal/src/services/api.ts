export type DocumentKind = 'aadhaar' | 'driving_licence';
export type UploadKind = 'passport' | 'identity_document' | 'fingerprint';

export interface HealthResponse {
  status?: string;
  [key: string]: unknown;
}

export interface VerificationEnvelope {
  success?: boolean;
  verification?: {
    identity_found?: boolean;
    document_verification?: boolean;
    fingerprint_match?: boolean;
    face_match?: boolean;
    liveness_passed?: boolean;
    hash_match?: boolean;
    final_status?: string;
    [key: string]: unknown;
  };
  identity?: Record<string, unknown> | null;
  documents?: unknown;
  fingerprint?: Record<string, unknown> | number | null;
  fingerprint_score?: number | null;
  face_score?: number | null;
  liveness?: boolean | Record<string, unknown> | null;
  integrity?: boolean | Record<string, unknown> | null;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function readResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === 'object' && body
      ? String((body as Record<string, unknown>).error || (body as Record<string, unknown>).message || `Request failed with status ${response.status}`)
      : String(body || `Request failed with status ${response.status}`);
    throw new ApiError(message, response.status);
  }
  return body as T;
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/health`, { method: 'GET', signal, credentials: 'include' });
  return readResponse<HealthResponse>(response);
}

export async function submitVerification(files: {
  passport: File;
  identityDocument: File;
  fingerprint: File;
}, signal?: AbortSignal): Promise<VerificationEnvelope> {
  const formData = new FormData();
  formData.append('passport', files.passport);
  formData.append('identity_document', files.identityDocument);
  formData.append('fingerprint_file', files.fingerprint);
  const response = await fetch(`${API_BASE}/verify`, {
    method: 'POST',
    body: formData,
    signal,
    credentials: 'include',
  });
  return readResponse<VerificationEnvelope>(response);
}