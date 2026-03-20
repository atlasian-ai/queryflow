import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Database, Play, Trash2, LogOut, FolderOpen, Search } from 'lucide-react'
import { listPipelines, createPipeline, deletePipeline } from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'
import type { Pipeline } from '@/types'
import QueryFlowLogo from '@/components/QueryFlowLogo'

export default function DashboardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user, logout } = useAuthStore()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')

  const { data: pipelines = [], isLoading } = useQuery<Pipeline[]>({
    queryKey: ['pipelines'],
    queryFn: listPipelines,
  })

  const filteredPipelines = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pipelines
    return pipelines.filter((p) => p.name.toLowerCase().includes(q))
  }, [pipelines, search])

  const createMutation = useMutation({
    mutationFn: createPipeline,
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ['pipelines'] }); navigate(`/pipelines/${p.id}`) },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePipeline,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    createMutation.mutate({ name: newName.trim() })
    setNewName('')
    setCreating(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <QueryFlowLogo size={30} idSuffix="dash-header" />
            <span className="font-bold text-slate-900 text-base tracking-tight">
              Query<span className="text-blue-600">Flow</span>
            </span>
          </div>
          <nav className="flex gap-4 text-sm">
            <span className="text-blue-600 font-medium">Pipelines</span>
            <Link to="/sources" className="text-slate-500 hover:text-slate-900">Data Sources</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{user?.email}</span>
          <button onClick={logout} className="text-slate-400 hover:text-slate-600">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-slate-900">Pipelines</h1>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> New Pipeline
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pipelines..."
            className="w-full pl-8 pr-4 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 placeholder:text-slate-400"
          />
        </div>

        {/* Create form */}
        {creating && (
          <form onSubmit={handleCreate} className="bg-white border rounded-lg p-4 mb-4 flex gap-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Pipeline name..."
              className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm">Create</button>
            <button type="button" onClick={() => setCreating(false)} className="text-slate-500 px-3 py-1.5 text-sm">Cancel</button>
          </form>
        )}

        {/* Pipeline list */}
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : filteredPipelines.length === 0 ? (
          <div className="bg-white border rounded-lg p-12 text-center">
            <FolderOpen size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              {search.trim() ? `No pipelines match "${search}"` : 'No pipelines yet. Create one to get started.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPipelines.map((p) => (
              <div
                key={p.id}
                className="bg-white border rounded-lg px-5 py-4 flex items-center justify-between hover:border-blue-300 transition-colors cursor-pointer"
                onClick={() => navigate(`/pipelines/${p.id}`)}
              >
                <div>
                  <p className="font-medium text-slate-900 text-sm">{p.name}</p>
                  {p.description && <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>}
                  <p className="text-xs text-slate-400 mt-1">
                    Updated {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/pipelines/${p.id}`) }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Play size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('Delete this pipeline?')) deleteMutation.mutate(p.id)
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
