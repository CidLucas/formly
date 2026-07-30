const API_BASE = import.meta.env.VITE_API_URL || '/api'

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || 'API error')
  }
  return res.json()
}

// Surveys
export const surveys = {
  list: () => api<any[]>('/surveys'),
  get: (id: string) => api<any>(`/surveys/${id}`),
  create: (data: any) => api<any>('/surveys', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => api<any>(`/surveys/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  publish: (id: string) => api<any>(`/surveys/${id}/publish`, { method: 'POST' }),
  stats: (id: string) => api<any>(`/surveys/${id}/stats`),
  responses: (id: string, params?: string) => api<any>(`/surveys/${id}/responses${params ? `?${params}` : ''}`),
}

// Public
export const publicApi = {
  getSurvey: (slug: string) => api<any>(`/public/surveys/${slug}`),
  submitResponse: (slug: string, data: any) => api<any>(`/public/surveys/${slug}/responses`, { method: 'POST', body: JSON.stringify(data) }),
}

// Contacts
export const contacts = {
  list: () => api<any[]>('/contacts'),
  create: (data: any) => api<any>('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => api<any>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => api<any>(`/contacts/${id}`, { method: 'DELETE' }),
}
