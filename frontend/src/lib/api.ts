import axios from 'axios'
import { supabase } from './supabase'

const rawUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
const BASE_URL = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`

export const api = axios.create({ baseURL: BASE_URL })

// Attach Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// ── Auth ──────────────────────────────────────────────────────────────────────
export const syncUser = (payload: { supabase_id: string; email: string; full_name?: string }) =>
  api.post('/auth/sync', payload).then(r => r.data)

export const getMe = () => api.get('/auth/me').then(r => r.data)

// ── Data Sources ──────────────────────────────────────────────────────────────
export const uploadSource = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/sources', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
}

export const listSources = () => api.get('/sources').then(r => r.data)
export const deleteSource = (id: string) => api.delete(`/sources/${id}`)

// ── Pipelines ─────────────────────────────────────────────────────────────────
export const listPipelines = () => api.get('/pipelines').then(r => r.data)
export const createPipeline = (payload: { name: string; description?: string }) =>
  api.post('/pipelines', payload).then(r => r.data)
export const getPipeline = (id: string) => api.get(`/pipelines/${id}`).then(r => r.data)
export const savePipeline = (id: string, payload: object) =>
  api.put(`/pipelines/${id}`, payload).then(r => r.data)
export const deletePipeline = (id: string) => api.delete(`/pipelines/${id}`)

export const generateSQL = (pipelineId: string, payload: { prompt: string; node_id: string }) =>
  api.post(`/pipelines/${pipelineId}/generate-sql`, payload).then(r => r.data)

// ── Runs ──────────────────────────────────────────────────────────────────────
export const triggerRun = (pipelineId: string) =>
  api.post(`/pipelines/${pipelineId}/run`).then(r => r.data)

export const getRun = (runId: string) =>
  api.get(`/pipelines/runs/${runId}`).then(r => r.data)

export const listRuns = (pipelineId: string) =>
  api.get(`/pipelines/${pipelineId}/runs`).then(r => r.data)

export const getNodeData = (runId: string, nodeId: string, offset = 0, limit = 200) =>
  api.get(`/pipelines/runs/${runId}/nodes/${nodeId}/data`, { params: { offset, limit } }).then(r => r.data)

export const getDownloadUrl = (runId: string, nodeId: string, format: 'csv' | 'xlsx') =>
  `${BASE_URL}/pipelines/runs/${runId}/nodes/${nodeId}/download?format=${format}`
