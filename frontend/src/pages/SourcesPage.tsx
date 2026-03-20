import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Trash2, FileSpreadsheet, ArrowLeft } from 'lucide-react'
import { listSources, uploadSource, deleteSource } from '@/lib/api'
import type { DataSource } from '@/types'

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function SourcesPage() {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: sources = [], isLoading } = useQuery<DataSource[]>({
    queryKey: ['sources'],
    queryFn: listSources,
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadSource(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSource,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources'] }),
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
    e.target.value = ''
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-3 flex items-center gap-4">
        <Link to="/" className="text-slate-400 hover:text-slate-600"><ArrowLeft size={18} /></Link>
        <span className="font-semibold text-slate-900">Data Sources</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Uploaded Files</h1>
            <p className="text-sm text-slate-500 mt-0.5">CSV and XLSX files available as SQL tables in your pipelines</p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Upload size={16} />
            {uploadMutation.isPending ? 'Uploading...' : 'Upload File'}
          </button>
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
        </div>

        {uploadMutation.isError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700 mb-4">
            Upload failed. Check the file format and try again.
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : sources.length === 0 ? (
          <div className="bg-white border rounded-lg p-12 text-center">
            <FileSpreadsheet size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No files uploaded yet.</p>
            <p className="text-slate-400 text-xs mt-1">Upload a CSV or Excel file to use it as a data source in your pipelines.</p>
          </div>
        ) : (
          <div className="bg-white border rounded-lg divide-y">
            {sources.map((s) => (
              <div key={s.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={18} className="text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      SQL table name: <code className="bg-slate-100 px-1 rounded font-mono">{s.slug}</code>
                      {' · '}{s.row_count?.toLocaleString()} rows
                      {' · '}{formatBytes(s.size_bytes)}
                    </p>
                    {s.column_schema && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Columns: {s.column_schema.map(c => c.name).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm('Delete this file?')) deleteMutation.mutate(s.id) }}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
