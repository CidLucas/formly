const API_BASE = import.meta.env.VITE_API_URL || '/api'

export interface Question {
  id?: string
  type: string
  title: string
  required: boolean
  config: Record<string, any>
}

export interface SurveyData {
  id?: string
  title: string
  questions: Question[]
  status?: string
  slug?: string
  theme?: string
  brand_colors?: any
}

export interface DistributeResult {
  status: string
  total: number
  sent: number
  failed: number
  mode: 'simulated' | 'real'
  public_link?: string
  message: string
}

export interface Contact {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  groups?: string[]
}

export interface ApiRequestInit extends RequestInit {
  auth?: boolean
}

function getToken(): string | null {
  return typeof window !== 'undefined' ? window.localStorage.getItem('formly_token') : null
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function toError(res: Response): Promise<Error> {
  const err = await res.json().catch(() => ({ message: res.statusText }))
  const error = new Error(err.message || 'API error') as Error & { status?: number }
  error.status = res.status
  return error
}

export async function api<T>(path: string, options?: ApiRequestInit): Promise<T> {
  const { auth = true, ...init } = options ?? {}
  const headers: Record<string, string> = {
    ...(auth ? authHeaders() : {}),
  }
  if (init.body && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!res.ok) throw await toError(res)
  return res.json()
}

// Surveys
export const surveys = {
  list: () => api<SurveyData[]>('/surveys/'),
  get: (id: string) => api<SurveyData>(`/surveys/${id}`),
  create: (data: SurveyData) => api<SurveyData>('/surveys/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<SurveyData>) => api<SurveyData>(`/surveys/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  publish: (id: string) => api<{ slug: string; url: string }>(`/surveys/${id}/publish`, { method: 'POST' }),
  distribute: (id: string, data: { contact_ids: string[]; emails: string[]; message?: string; from_email?: string; from_name?: string }) =>
    api<DistributeResult>(`/surveys/${id}/distribute`, { method: 'POST', body: JSON.stringify(data) }),
  stats: (id: string) => api<any>(`/surveys/${id}/stats`),
  responses: (id: string, params?: string) => api<any>(`/surveys/${id}/responses${params ? `?${params}` : ''}`),
  exportCsv: async (id: string): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/surveys/${id}/export?format=csv`, {
      headers: authHeaders(),
    })
    if (!res.ok) throw await toError(res)
    return res.blob()
  },
}

// IA
export const ai = {
  skeleton: (description: string) => api<SurveyData>('/ai/skeleton', { method: 'POST', body: JSON.stringify({ description }) }),
  refinementQuestions: (description: string) =>
    api<{ questions: string[] }>('/ai/refinement-questions', { method: 'POST', body: JSON.stringify({ description }) }),
  refine: (survey: any, message: string) => api<{ reply: string }>('/ai/refine', { method: 'POST', body: JSON.stringify({ survey, message }) }),
}

// Transcrição de áudio (pública, sem auth)
export async function transcribe(file: File): Promise<{ text: string; duration_secs?: number }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/transcribe`, { method: 'POST', body: form })
  if (!res.ok) throw await toError(res)
  return res.json()
}

// Public
export const publicApi = {
  getSurvey: (slug: string) => api<any>(`/public/surveys/${slug}`, { auth: false }),
  submitResponse: (slug: string, data: any) =>
    api<any>(`/public/surveys/${slug}/responses`, { method: 'POST', body: JSON.stringify(data), auth: false }),
  partial: (slug: string, data: any) =>
    api<any>(`/public/surveys/${slug}/responses/partial`, { method: 'POST', body: JSON.stringify(data), auth: false }),
}

// Contacts
export const contacts = {
  list: () => api<Contact[]>('/contacts/'),
  create: (data: Partial<Contact>) => api<Contact>('/contacts/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Contact>) => api<Contact>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => api<any>(`/contacts/${id}`, { method: 'DELETE' }),
}
