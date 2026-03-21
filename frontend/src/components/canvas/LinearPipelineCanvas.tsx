/**
 * Linear vertical pipeline canvas — Workato-style top-to-bottom flow.
 * Light theme with numbered step badges and clean connector lines.
 */
import React, { useState } from 'react'
import {
  Plus, CheckCircle2, XCircle, Loader2, Clock,
  Database, Trash2, ZoomIn, ZoomOut, RotateCcw,
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { usePipelineStore } from '@/store/usePipelineStore'
import type { DataSource } from '@/types'

function generateSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'node'
}

function StatusIcon({ status }: { status?: string }) {
  switch (status) {
    case 'success': return <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
    case 'failed':  return <XCircle      size={15} className="text-red-500    flex-shrink-0" />
    case 'running': return <Loader2      size={15} className="text-blue-500   animate-spin flex-shrink-0" />
    case 'pending': return <Clock        size={15} className="text-slate-400  flex-shrink-0" />
    default: return null
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1 select-none">
      {children}
    </p>
  )
}

/** Vertical connector segment */
function Line({ height = 'h-5' }: { height?: string }) {
  return <div className={`w-px ${height} bg-slate-200 flex-shrink-0`} />
}

/** Small add-step button shown between steps */
function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Add step here"
      className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center
                 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50
                 transition-all flex-shrink-0 bg-white"
    >
      <Plus size={11} />
    </button>
  )
}

// ── Zoom controls ──────────────────────────────────────────────────────────────
const MIN_ZOOM = 0.5
const MAX_ZOOM = 1.5
const ZOOM_STEP = 0.1

function ZoomControls({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }) {
  const btn = 'flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors'
  return (
    <div className="absolute bottom-4 left-4 flex items-center gap-0.5 rounded-lg z-20 px-1 py-1 bg-white border border-slate-200 shadow-sm">
      <button className={btn} onClick={() => setZoom(Math.max(MIN_ZOOM, parseFloat((zoom - ZOOM_STEP).toFixed(1))))} title="Zoom out">
        <ZoomOut size={13} />
      </button>
      <button
        className="text-xs tabular-nums px-1.5 rounded text-slate-500 hover:bg-slate-100 transition-colors"
        style={{ minWidth: 40, textAlign: 'center' }}
        onClick={() => setZoom(1)}
        title="Reset zoom"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button className={btn} onClick={() => setZoom(Math.min(MAX_ZOOM, parseFloat((zoom + ZOOM_STEP).toFixed(1))))} title="Zoom in">
        <ZoomIn size={13} />
      </button>
      <div className="w-px h-4 mx-0.5 bg-slate-200" />
      <button className={btn} onClick={() => setZoom(1)} title="Reset zoom">
        <RotateCcw size={12} />
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  onNodeClick:    (nodeId: string) => void
  onSourceClick:  (sourceId: string) => void
  dataSources:    DataSource[]
  selectedSourceId: string | null
}

export default function LinearPipelineCanvas({
  onNodeClick, onSourceClick, dataSources, selectedSourceId,
}: Props) {
  const { nodes, selectedNodeId, setSelectedNode, insertNodeAfterIndex, removeNode } = usePipelineStore()
  const [pendingInsertAfter, setPendingInsertAfter] = useState<number | null>(null)
  const [newNodeLabel, setNewNodeLabel] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  const handleNodeClick = (nodeId: string) => { setSelectedNode(nodeId); onNodeClick(nodeId) }
  const openAddDialog = (afterIndex: number) => { setPendingInsertAfter(afterIndex); setNewNodeLabel('') }

  const confirmAddNode = () => {
    if (!newNodeLabel.trim() || pendingInsertAfter === null) return
    const label = newNodeLabel.trim()
    const newNode = {
      id: uuidv4(), type: 'transformNode' as const, position: { x: 0, y: 0 },
      data: { label, slug: generateSlug(label), node_type: 'transform' as const,
              data_source_id: null, prompt: null, sql: null },
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
    if (usePipelineStore.getState().selectedNodeId === nodeId) setSelectedNode(null)
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden relative bg-slate-50">
      {/* Zoomed content */}
      <div style={{ zoom, transformOrigin: 'top center' }}>
        <div className="flex flex-col items-center py-10 px-4 sm:px-8 min-h-full">
          <div className="w-full max-w-xl">

            {/* ── DATA SOURCES section ─────────────────────────────── */}
            {dataSources.length > 0 && (
              <>
                <SectionLabel>Data Sources</SectionLabel>
                {dataSources.map((ds, i) => {
                  const active = selectedSourceId === ds.id
                  return (
                    <React.Fragment key={ds.id}>
                      {/* Connector row */}
                      <div className="flex items-stretch gap-3">
                        {/* Left gutter */}
                        <div className="w-8 flex-shrink-0 flex flex-col items-center">
                          {i === 0 && <Line height="h-2" />}
                          {i > 0 && <Line height="h-3" />}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                            active ? 'bg-emerald-500' : 'bg-emerald-700'
                          }`}>
                            <Database size={13} className="text-white" />
                          </div>
                          <Line height="h-3" />
                        </div>
                        {/* Source chip */}
                        <div className="flex-1 py-1">
                          <button
                            onClick={() => onSourceClick(ds.id)}
                            className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
                              active
                                ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                                : 'bg-white border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium font-mono text-slate-800">{ds.slug}</span>
                              {ds.row_count != null && (
                                <span className="text-xs text-slate-400 tabular-nums">{ds.row_count.toLocaleString()} rows</span>
                              )}
                            </div>
                            {ds.name !== ds.slug && (
                              <p className="text-xs text-slate-500 mt-0.5">{ds.name}</p>
                            )}
                          </button>
                        </div>
                      </div>
                    </React.Fragment>
                  )
                })}

                {/* Connector from sources to steps */}
                {nodes.length > 0 && (
                  <div className="flex gap-3">
                    <div className="w-8 flex-shrink-0 flex justify-center">
                      <div className="w-px h-5 bg-slate-200" />
                    </div>
                    <div className="flex-1" />
                  </div>
                )}
              </>
            )}

            {/* ── STEPS section ────────────────────────────────────── */}
            {nodes.length > 0 && <SectionLabel>Steps</SectionLabel>}

            {/* ── Empty state ──────────────────────────────────────── */}
            {nodes.length === 0 && (
              <div className="flex flex-col items-center gap-3 mt-4">
                <div className="flex gap-3 items-center">
                  <div className="w-8 flex-shrink-0 flex justify-center">
                    <AddButton onClick={() => openAddDialog(-1)} />
                  </div>
                  <p className="text-sm text-slate-400">Add your first step</p>
                </div>
              </div>
            )}

            {/* ── Nodes ────────────────────────────────────────────── */}
            {nodes.map((node, index) => {
              const isSelected = selectedNodeId === node.id
              const status = node.data.runStatus as string | undefined

              return (
                <React.Fragment key={node.id}>
                  {/* Step row */}
                  <div className="flex items-stretch gap-3">
                    {/* Left gutter: line + number badge + line */}
                    <div className="w-8 flex-shrink-0 flex flex-col items-center">
                      <Line height="h-2" />
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 transition-colors ${
                        status === 'success' ? 'bg-emerald-500'
                        : status === 'failed'  ? 'bg-red-500'
                        : status === 'running' ? 'bg-blue-500'
                        : isSelected           ? 'bg-blue-600'
                        : 'bg-slate-400'
                      }`}>
                        {status === 'success' ? <CheckCircle2 size={14} />
                         : status === 'failed'  ? <XCircle size={14} />
                         : status === 'running' ? <Loader2 size={12} className="animate-spin" />
                         : index + 1}
                      </div>
                      <Line height="h-2" />
                    </div>

                    {/* Card */}
                    <div className="flex-1 py-1.5">
                      <div
                        onClick={() => handleNodeClick(node.id)}
                        className={`bg-white rounded-lg border cursor-pointer transition-all group ${
                          isSelected
                            ? 'border-blue-400 shadow-md shadow-blue-100 ring-1 ring-blue-300'
                            : status === 'success'
                            ? 'border-emerald-300'
                            : status === 'failed'
                            ? 'border-red-300'
                            : 'border-slate-200 hover:border-blue-200 hover:shadow-sm'
                        }`}
                      >
                        {/* Card header */}
                        <div className="px-4 py-3 flex items-center gap-3">
                          {/* Step type badge */}
                          <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${
                            node.data.node_type === 'source' ? 'bg-emerald-100' : 'bg-blue-100'
                          }`}>
                            <span className={`text-xs font-bold ${
                              node.data.node_type === 'source' ? 'text-emerald-700' : 'text-blue-700'
                            }`}>
                              {node.data.node_type === 'source' ? 'S' : 'T'}
                            </span>
                          </div>

                          {/* Label */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate leading-tight">
                              {node.data.label}
                            </p>
                            <p className="text-xs font-mono text-slate-400 mt-0.5">{node.data.slug}</p>
                          </div>

                          {/* Status icon + row count */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <StatusIcon status={status} />
                            {node.data.rowCount != null && (
                              <span className="text-xs tabular-nums px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {(node.data.rowCount as number).toLocaleString()} rows
                              </span>
                            )}
                            {node.data.errorMessage && (
                              <span className="text-xs text-red-500 truncate max-w-[100px]"
                                    title={node.data.errorMessage as string}>
                                {node.data.errorMessage}
                              </span>
                            )}
                            {/* Delete — on hover */}
                            <button
                              onClick={e => { e.stopPropagation(); setConfirmDeleteId(node.id) }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                              title="Delete step"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* SQL preview */}
                        <div className="px-4 pb-3 pl-14">
                          {node.data.sql ? (
                            <p className="text-xs font-mono text-slate-400 truncate">
                              {(node.data.sql as string).replace(/\s+/g, ' ').slice(0, 100)}
                              {(node.data.sql as string).length > 100 ? '…' : ''}
                            </p>
                          ) : (
                            <p className="text-xs italic text-slate-300">
                              No SQL yet — click to configure
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Add button row between steps */}
                  <div className="flex items-center gap-3 h-9">
                    <div className="w-8 flex-shrink-0 flex flex-col items-center h-full">
                      <Line height="h-full" />
                    </div>
                    <div className="flex items-center gap-2">
                      <AddButton onClick={() => openAddDialog(index)} />
                    </div>
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Zoom controls ──────────────────────────────────────────── */}
      <ZoomControls zoom={zoom} setZoom={setZoom} />

      {/* ── Add step dialog ────────────────────────────────────────── */}
      {pendingInsertAfter !== null && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-full max-w-sm">
            <p className="text-sm font-semibold text-slate-800 mb-4">Name this step</p>
            <input
              autoFocus
              value={newNodeLabel}
              onChange={e => setNewNodeLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmAddNode()
                if (e.key === 'Escape') { setPendingInsertAfter(null); setNewNodeLabel('') }
              }}
              placeholder="e.g. Filter paid invoices"
              className="w-full rounded-lg px-3 py-2 text-sm border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-slate-800 placeholder:text-slate-400"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setPendingInsertAfter(null); setNewNodeLabel('') }}
                className="text-sm px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddNode}
                disabled={!newNodeLabel.trim()}
                className="text-sm text-white px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-40"
              >
                Add step
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation dialog ─────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-full max-w-sm">
            <p className="text-sm font-semibold text-slate-800 mb-1">Delete this step?</p>
            <p className="text-xs text-slate-500 mb-5">The step and its SQL will be removed permanently.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="text-sm px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteNode(confirmDeleteId)}
                className="text-sm text-white px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors"
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
