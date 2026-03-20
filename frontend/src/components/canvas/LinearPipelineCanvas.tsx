/**
 * Linear vertical pipeline canvas — Workato-style top-to-bottom flow.
 * No free-form dragging. Nodes execute top → bottom.
 * Data sources shown as clickable chips at the top.
 */
import React, { useState } from 'react'
import {
  Plus, CheckCircle2, XCircle, Loader2, Clock,
  ChevronRight, Database, Trash2,
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { usePipelineStore } from '@/store/usePipelineStore'
import type { DataSource } from '@/types'

function generateSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'node'
}

function StatusIcon({ status }: { status?: string }) {
  switch (status) {
    case 'success': return <CheckCircle2 size={15} className="text-green-400 flex-shrink-0" />
    case 'failed':  return <XCircle size={15} className="text-red-400 flex-shrink-0" />
    case 'running': return <Loader2 size={15} className="text-blue-400 animate-spin flex-shrink-0" />
    case 'pending': return <Clock size={15} className="text-slate-500 flex-shrink-0" />
    default:        return <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-600 flex-shrink-0" />
  }
}

interface AddButtonProps { onClick: () => void }
function AddButton({ onClick }: AddButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-dashed border-slate-600 text-slate-500 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-950/40 transition-all"
      title="Add step here"
    >
      <Plus size={13} />
    </button>
  )
}

interface Props {
  onNodeClick: (nodeId: string) => void
  onSourceClick: (sourceId: string) => void
  dataSources: DataSource[]
  selectedSourceId: string | null
}

export default function LinearPipelineCanvas({
  onNodeClick, onSourceClick, dataSources, selectedSourceId,
}: Props) {
  const { nodes, selectedNodeId, setSelectedNode, insertNodeAfterIndex, removeNode } = usePipelineStore()
  const [pendingInsertAfter, setPendingInsertAfter] = useState<number | null>(null)
  const [newNodeLabel, setNewNodeLabel] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId)
    onNodeClick(nodeId)
  }

  const openAddDialog = (afterIndex: number) => {
    setPendingInsertAfter(afterIndex)
    setNewNodeLabel('')
  }

  const confirmAddNode = () => {
    if (!newNodeLabel.trim() || pendingInsertAfter === null) return
    const label = newNodeLabel.trim()
    const newNode = {
      id: uuidv4(),
      type: 'transformNode' as const,
      position: { x: 0, y: 0 },
      data: {
        label,
        slug: generateSlug(label),
        node_type: 'transform' as const,
        data_source_id: null,
        prompt: null,
        sql: null,
      },
    }
    insertNodeAfterIndex(newNode, pendingInsertAfter)
    setSelectedNode(newNode.id)
    onNodeClick(newNode.id)
    setPendingInsertAfter(null)
    setNewNodeLabel('')
  }

  const handleDeleteNode = (nodeId: string) => {
    setConfirmDeleteId(null)
    removeNode(nodeId)
    if (usePipelineStore.getState().selectedNodeId === nodeId) {
      setSelectedNode(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ background: '#111827' }}>
      <div className="flex flex-col items-center py-8 px-6 min-h-full">

        {/* ── Data Sources ───────────────────────────────────────────── */}
        {dataSources.length > 0 && (
          <div className="w-full max-w-lg mb-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3 flex items-center gap-2">
              <Database size={12} /> Data Sources
            </p>
            <div className="flex flex-wrap gap-2">
              {dataSources.map((ds) => (
                <button
                  key={ds.id}
                  onClick={() => onSourceClick(ds.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    selectedSourceId === ds.id
                      ? 'bg-emerald-700 border-emerald-500 text-white shadow shadow-emerald-900/50'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-emerald-600 hover:text-emerald-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="font-mono">{ds.slug}</span>
                  {ds.row_count != null && (
                    <span className={selectedSourceId === ds.id ? 'text-emerald-200' : 'text-slate-500'}>
                      {ds.row_count.toLocaleString()} rows
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Connector from sources to first node */}
        {dataSources.length > 0 && (
          <div className="flex flex-col items-center my-1">
            <div className="w-px h-6 bg-slate-700" />
          </div>
        )}

        {/* ── First + button (when no nodes yet) ─────────────────────── */}
        {nodes.length === 0 && (
          <div className="flex flex-col items-center gap-3 mt-4">
            <AddButton onClick={() => openAddDialog(-1)} />
            <p className="text-xs text-slate-600">Add your first step</p>
          </div>
        )}

        {/* ── Nodes ──────────────────────────────────────────────────── */}
        <div className="w-full max-w-lg flex flex-col items-center">
          {nodes.map((node, index) => {
            const isSelected = selectedNodeId === node.id
            const status = node.data.runStatus as string | undefined

            return (
              <React.Fragment key={node.id}>
                {/* Node card */}
                <div
                  onClick={() => handleNodeClick(node.id)}
                  className={`w-full rounded-xl border cursor-pointer transition-all group ${
                    isSelected
                      ? 'border-blue-500 bg-slate-800 shadow-lg shadow-blue-900/30 ring-1 ring-blue-500/20'
                      : status === 'failed'
                      ? 'border-red-800 bg-slate-800 hover:border-red-600'
                      : status === 'success'
                      ? 'border-green-800 bg-slate-800 hover:border-green-600'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                  }`}
                >
                  <div className="px-4 py-3 flex items-center gap-3">
                    {/* Step number */}
                    <span className="text-xs text-slate-600 font-mono w-5 text-right flex-shrink-0">
                      {index + 1}
                    </span>

                    {/* Status icon */}
                    <StatusIcon status={status} />

                    {/* Labels */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{node.data.label}</p>
                      <p className="text-xs text-slate-500 font-mono">{node.data.slug}</p>
                    </div>

                    {/* Row count */}
                    {node.data.rowCount != null && (
                      <span className="text-xs text-slate-400 flex-shrink-0 tabular-nums">
                        {(node.data.rowCount as number).toLocaleString()} rows
                      </span>
                    )}

                    {/* Error message */}
                    {node.data.errorMessage && (
                      <span className="text-xs text-red-400 truncate max-w-[120px]" title={node.data.errorMessage as string}>
                        {node.data.errorMessage}
                      </span>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(node.id) }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-400 hover:bg-red-950/40 rounded transition-all"
                      title="Delete step"
                    >
                      <Trash2 size={13} />
                    </button>

                    <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
                  </div>

                  {/* SQL preview strip */}
                  {node.data.sql && (
                    <div className="px-4 pb-2.5 pl-12">
                      <p className="text-xs text-slate-600 font-mono truncate">
                        {(node.data.sql as string).replace(/\s+/g, ' ').slice(0, 80)}
                        {(node.data.sql as string).length > 80 ? '…' : ''}
                      </p>
                    </div>
                  )}
                  {!node.data.sql && (
                    <div className="px-4 pb-2.5 pl-12">
                      <p className="text-xs text-slate-600 italic">No SQL yet — click to edit</p>
                    </div>
                  )}
                </div>

                {/* Connector + Add button between nodes */}
                <div className="flex flex-col items-center my-0.5">
                  <div className="w-px h-3 bg-slate-700" />
                  <AddButton onClick={() => openAddDialog(index)} />
                  {index < nodes.length - 1 && <div className="w-px h-3 bg-slate-700" />}
                </div>
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* ── Add step dialog ─────────────────────────────────────────── */}
      {pendingInsertAfter !== null && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl border p-6 w-80">
            <p className="text-sm font-semibold text-slate-800 mb-4">Name this step</p>
            <input
              autoFocus
              value={newNodeLabel}
              onChange={(e) => setNewNodeLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmAddNode()
                if (e.key === 'Escape') { setPendingInsertAfter(null); setNewNodeLabel('') }
              }}
              placeholder="e.g. Filter paid invoices"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setPendingInsertAfter(null); setNewNodeLabel('') }}
                className="text-sm text-slate-500 px-4 py-2 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddNode}
                disabled={!newNodeLabel.trim()}
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40"
              >
                Add step
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation dialog ──────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl border p-6 w-80">
            <p className="text-sm font-semibold text-slate-800 mb-2">Delete this step?</p>
            <p className="text-xs text-slate-500 mb-4">
              This will remove the step and any SQL written for it. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="text-sm text-slate-500 px-4 py-2 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteNode(confirmDeleteId)}
                className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
