import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Database, LogOut, Search, MoreHorizontal,
  Trash2, FolderOpen, FolderPlus, ChevronRight, X,
} from 'lucide-react'
import {
  listPipelines, createPipeline, deletePipeline, savePipeline,
  listFolders, createFolder, updateFolder, deleteFolder,
} from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'
import type { Pipeline, PipelineFolder } from '@/types'
import QueryFlowLogo from '@/components/QueryFlowLogo'

// ── Emoji sets ────────────────────────────────────────────────────────────────
const PIPELINE_EMOJIS = [
  '📊','📈','🔄','🔍','💹','🛠️','📦','🔗','💡','🎯',
  '📋','🏗️','🚀','⚡','🔧','💰','📅','🌐','🔐','📤',
  '📥','🗃️','🧮','📝','⚙️','🔬','🧩','🎨','💫','🔮',
]
const FOLDER_EMOJIS = [
  '📁','📂','🗂️','🏢','💼','🎯','🌟','⭐','🔑','🏆',
  '💎','🚀','⚡','📊','🔬','🧩','🎭','🌈','🔧','📦',
]

// ── Small emoji picker ────────────────────────────────────────────────────────
function EmojiPicker({ value, onChange, emojis }: { value: string; onChange: (e: string) => void; emojis: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {emojis.map(e => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          className={`text-lg p-1.5 rounded-lg transition-colors ${value === e ? 'bg-blue-100 ring-2 ring-blue-400' : 'hover:bg-slate-100'}`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}

// ── Pipeline tile ─────────────────────────────────────────────────────────────
function PipelineTile({
  pipeline, folders, onOpen, onDelete, onMove,
}: {
  pipeline: Pipeline
  folders: PipelineFolder[]
  onOpen: () => void
  onDelete: () => void
  onMove: (folderId: string | null) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false); setShowMoveMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const updated = new Date(pipeline.updated_at)
  const dateStr = updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div
      onClick={onOpen}
      className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md
                 transition-all cursor-pointer flex flex-col"
    >
      {/* Card body */}
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">{pipeline.emoji || '📊'}</span>
            <h3 className="font-semibold text-slate-800 leading-snug truncate">{pipeline.name}</h3>
          </div>

          {/* ··· menu */}
          <div ref={menuRef} className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setMenuOpen(o => !o); setShowMoveMenu(false) }}
              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-7 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1.5 w-44 text-sm">
                <button
                  onClick={() => { setMenuOpen(false); onOpen() }}
                  className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Open pipeline
                </button>

                {/* Move to folder */}
                <div className="relative">
                  <button
                    onClick={() => setShowMoveMenu(m => !m)}
                    className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    Move to folder <ChevronRight size={13} />
                  </button>
                  {showMoveMenu && (
                    <div className="absolute left-full top-0 ml-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 w-44 text-sm">
                      <button
                        onClick={() => { onMove(null); setMenuOpen(false); setShowMoveMenu(false) }}
                        className={`w-full text-left px-4 py-2 hover:bg-slate-50 ${!pipeline.folder_id ? 'text-blue-600 font-medium' : 'text-slate-600'}`}
                      >
                        No folder
                      </button>
                      {folders.map(f => (
                        <button
                          key={f.id}
                          onClick={() => { onMove(f.id); setMenuOpen(false); setShowMoveMenu(false) }}
                          className={`w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 ${pipeline.folder_id === f.id ? 'text-blue-600 font-medium' : 'text-slate-600'}`}
                        >
                          <span>{f.emoji}</span> {f.name}
                        </button>
                      ))}
                      {folders.length === 0 && (
                        <p className="px-4 py-2 text-slate-400 italic">No folders yet</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => { setMenuOpen(false); onDelete() }}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {pipeline.description ? (
          <p className="text-sm text-slate-500 mt-3 line-clamp-2 leading-relaxed">{pipeline.description}</p>
        ) : (
          <p className="text-sm text-slate-300 mt-3 italic">No description</p>
        )}
      </div>

      {/* Card footer */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
        <p className="text-xs text-slate-400">Updated {dateStr}</p>
        {pipeline.folder_id && (
          <span className="text-xs text-slate-400">
            {folders.find(f => f.id === pipeline.folder_id)?.emoji}{' '}
            {folders.find(f => f.id === pipeline.folder_id)?.name}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Create Pipeline Modal ─────────────────────────────────────────────────────
function CreatePipelineModal({
  folders, defaultFolderId, onClose, onCreate,
}: {
  folders: PipelineFolder[]
  defaultFolderId: string | null
  onClose: () => void
  onCreate: (p: Pipeline) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('📊')
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? '')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const p = await createPipeline({
        name: name.trim(),
        description: description.trim() || undefined,
        emoji,
        folder_id: folderId || undefined,
      })
      onCreate(p)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
          <h2 className="font-semibold text-slate-800">New pipeline</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Emoji */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Icon</label>
            <EmojiPicker value={emoji} onChange={setEmoji} emojis={PIPELINE_EMOJIS} />
          </div>

          {/* Name */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Name <span className="text-red-500">*</span></label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Monthly Revenue Summary"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this pipeline do?"
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Folder */}
          {folders.length > 0 && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Folder</label>
              <select
                value={folderId}
                onChange={e => setFolderId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">No folder</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Creating…' : 'Create pipeline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Create / Edit Folder Modal ────────────────────────────────────────────────
function FolderModal({
  initial, onClose, onSave,
}: {
  initial?: PipelineFolder
  onClose: () => void
  onSave: (f: PipelineFolder) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '📁')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const f = initial
        ? await updateFolder(initial.id, { name: name.trim(), emoji })
        : await createFolder({ name: name.trim(), emoji })
      onSave(f)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
          <h2 className="font-semibold text-slate-800">{initial ? 'Edit folder' : 'New folder'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Icon</label>
            <EmojiPicker value={emoji} onChange={setEmoji} emojis={FOLDER_EMOJIS} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Name <span className="text-red-500">*</span></label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Finance"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Saving…' : initial ? 'Save changes' : 'Create folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user, logout } = useAuthStore()

  // View state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'updated' | 'name'>('updated')

  // Modals
  const [showCreatePipeline, setShowCreatePipeline] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [editingFolder, setEditingFolder] = useState<PipelineFolder | null>(null)

  // Data
  const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery<Pipeline[]>({
    queryKey: ['pipelines'], queryFn: listPipelines,
  })
  const { data: folders = [] } = useQuery<PipelineFolder[]>({
    queryKey: ['folders'], queryFn: listFolders,
  })

  const deletePipelineMutation = useMutation({
    mutationFn: deletePipeline,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) =>
      savePipeline(id, { folder_id: folderId ?? '' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  })

  const deleteFolderMutation = useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] })
      qc.invalidateQueries({ queryKey: ['pipelines'] })
      if (selectedFolderId) setSelectedFolderId(null)
    },
  })

  // Filtered + sorted pipelines
  const filteredPipelines = useMemo(() => {
    let list = pipelines

    // Filter by folder
    if (selectedFolderId) {
      list = list.filter(p => p.folder_id === selectedFolderId)
    }

    // Filter by search
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))

    // Sort
    return [...list].sort((a, b) =>
      sortBy === 'name'
        ? a.name.localeCompare(b.name)
        : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  }, [pipelines, selectedFolderId, search, sortBy])

  const currentFolderName = selectedFolderId
    ? folders.find(f => f.id === selectedFolderId)?.name ?? 'Folder'
    : 'All Pipelines'

  const sidebarItem = (active: boolean) =>
    `w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
      active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-100'
    }`

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50">

      {/* ── Left Sidebar ─────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-white border-r flex flex-col overflow-hidden">
        {/* Logo */}
        <div className="px-4 py-3.5 border-b flex items-center gap-2.5">
          <QueryFlowLogo size={26} idSuffix="dash-sidebar" />
          <span className="font-bold text-slate-800 text-sm tracking-tight">
            Dato<span className="text-blue-600">pia</span>
          </span>
        </div>

        {/* ASSETS */}
        <div className="px-2 pt-4 pb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-3 mb-1">Assets</p>
          <button
            onClick={() => setSelectedFolderId(null)}
            className={sidebarItem(selectedFolderId === null)}
          >
            <FolderOpen size={14} className="flex-shrink-0" />
            <span className="flex-1 truncate">All Pipelines</span>
            <span className="text-xs text-slate-400 flex-shrink-0">{pipelines.length}</span>
          </button>
          <Link to="/sources" className={sidebarItem(false)}>
            <Database size={14} className="flex-shrink-0" />
            <span className="flex-1">Data Sources</span>
          </Link>
        </div>

        <div className="mx-3 border-t border-slate-100" />

        {/* FOLDERS */}
        <div className="px-2 pt-3 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-3 mb-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Folders</p>
            <button
              onClick={() => setShowCreateFolder(true)}
              className="text-slate-400 hover:text-blue-600 transition-colors"
              title="New folder"
            >
              <Plus size={14} />
            </button>
          </div>

          {folders.map(f => {
            const count = pipelines.filter(p => p.folder_id === f.id).length
            return (
              <div key={f.id} className="group relative">
                <button
                  onClick={() => setSelectedFolderId(f.id)}
                  className={sidebarItem(selectedFolderId === f.id)}
                >
                  <span className="flex-shrink-0">{f.emoji}</span>
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-slate-400 flex-shrink-0">{count}</span>
                </button>
                {/* Folder context actions — on hover */}
                <div className="absolute right-1 top-1 hidden group-hover:flex gap-0.5">
                  <button
                    onClick={e => { e.stopPropagation(); setEditingFolder(f) }}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 bg-white"
                    title="Edit folder"
                  >
                    <FolderPlus size={11} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      if (confirm(`Delete folder "${f.name}"? Pipelines inside will remain.`))
                        deleteFolderMutation.mutate(f.id)
                    }}
                    className="p-1 rounded text-slate-400 hover:text-red-500 bg-white"
                    title="Delete folder"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            )
          })}

          {folders.length === 0 && (
            <button
              onClick={() => setShowCreateFolder(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
            >
              <FolderPlus size={13} /> New folder
            </button>
          )}
        </div>

        {/* User footer */}
        <div className="px-4 py-3 border-t flex items-center gap-2">
          <span className="text-xs text-slate-500 truncate flex-1">{user?.email}</span>
          <button onClick={logout} className="text-slate-400 hover:text-slate-600" title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0">
          <h1 className="text-lg font-semibold text-slate-800 truncate">{currentFolderName}</h1>
          <button
            onClick={() => setShowCreatePipeline(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            <Plus size={15} /> Create pipeline
          </button>
        </div>

        {/* Search + sort */}
        <div className="bg-white border-b px-6 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search pipelines…"
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-500 flex-shrink-0">
            <span className="hidden sm:block">Sort by</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'updated' | 'name')}
              className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="updated">Latest activity</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {pipelinesLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 mt-8 justify-center">
              <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              Loading…
            </div>
          ) : filteredPipelines.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 mt-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl">
                {selectedFolderId ? (folders.find(f => f.id === selectedFolderId)?.emoji ?? '📁') : '📊'}
              </div>
              <div>
                <p className="font-medium text-slate-700">
                  {search.trim() ? `No pipelines match "${search}"` : 'No pipelines here yet'}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {search.trim() ? 'Try a different search term.' : 'Create your first pipeline to get started.'}
                </p>
              </div>
              {!search.trim() && (
                <button
                  onClick={() => setShowCreatePipeline(true)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  <Plus size={15} /> Create pipeline
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPipelines.map(p => (
                <PipelineTile
                  key={p.id}
                  pipeline={p}
                  folders={folders}
                  onOpen={() => navigate(`/pipelines/${p.id}`)}
                  onDelete={() => {
                    if (confirm(`Delete "${p.name}"?`)) deletePipelineMutation.mutate(p.id)
                  }}
                  onMove={(folderId) => moveMutation.mutate({ id: p.id, folderId })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showCreatePipeline && (
        <CreatePipelineModal
          folders={folders}
          defaultFolderId={selectedFolderId}
          onClose={() => setShowCreatePipeline(false)}
          onCreate={(p) => {
            qc.invalidateQueries({ queryKey: ['pipelines'] })
            setShowCreatePipeline(false)
            navigate(`/pipelines/${p.id}`)
          }}
        />
      )}

      {(showCreateFolder || editingFolder) && (
        <FolderModal
          initial={editingFolder ?? undefined}
          onClose={() => { setShowCreateFolder(false); setEditingFolder(null) }}
          onSave={() => {
            qc.invalidateQueries({ queryKey: ['folders'] })
            setShowCreateFolder(false)
            setEditingFolder(null)
          }}
        />
      )}
    </div>
  )
}
