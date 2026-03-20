/**
 * Linear vertical pipeline canvas — Workato-style top-to-bottom flow.
 * Styled to match the Railway canvas aesthetic.
 * No free-form dragging. Nodes execute top → bottom.
 */
import React, { useState } from 'react'
import {
  Plus, CheckCircle2, XCircle, Loader2, Clock,
  Database, Trash2, ZoomIn, ZoomOut, RotateCcw,
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { usePipelineStore } from '@/store/usePipelineStore'
import type { DataSource } from '@/types'

// ── Design tokens (Railway palette) ──────────────────────────────────────────
const C = {
  canvasBg:        '#0d1117',
  cardBg:          '#161b27',
  cardBorder:      '#21293a',
  cardBorderHover: '#2d3a54',
  cardBorderSel:   '#2563eb',
  cardBorderFail:  '#7f1d1d',
  cardBorderOk:    '#14532d',
  connectorLine:   '#1a2236',
  connectorDot:    '#0d1117',
  connectorDotB:   '#21293a',
  textPrimary:     '#e2e8f0',
  textSecondary:   '#64748b',
  textMuted:       '#2d3a54',
}

function generateSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'node'
}

function StatusIcon({ status }: { status?: string }) {
  switch (status) {
    case 'success': return <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
    case 'failed':  return <XCircle      size={14} className="text-red-400    flex-shrink-0" />
    case 'running': return <Loader2      size={14} className="text-blue-400   animate-spin flex-shrink-0" />
    case 'pending': return <Clock        size={14} className="text-slate-500  flex-shrink-0" />
    default: return (
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ border: `2px solid ${C.cardBorderHover}` }}
      />
    )
  }
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Add step here"
      className="flex items-center justify-center w-6 h-6 rounded-full transition-all"
      style={{
        border: `1.5px dashed ${C.cardBorder}`,
        color: C.textSecondary,
        background: 'transparent',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#3b82f6'
        ;(e.currentTarget as HTMLButtonElement).style.color = '#60a5fa'
        ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.08)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = C.cardBorder
        ;(e.currentTarget as HTMLButtonElement).style.color = C.textSecondary
        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      <Plus size={12} />
    </button>
  )
}

/** Thin vertical connector with a dot in the middle */
function Connector({ showDot = true }: { showDot?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-px h-3" style={{ background: C.connectorLine }} />
      {showDot && (
        <>
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: C.connectorDot, border: `1.5px solid ${C.connectorDotB}` }}
          />
          <div className="w-px h-3" style={{ background: C.connectorLine }} />
        </>
      )}
    </div>
  )
}

// ── Zoom controls ─────────────────────────────────────────────────────────────
const MIN_ZOOM = 0.4
const MAX_ZOOM = 1.5
const ZOOM_STEP = 0.1

function ZoomControls({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }) {
  const btnCls = `flex items-center justify-center w-7 h-7 rounded transition-colors`
  const btnStyle = { color: C.textSecondary }
  const btnHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    ;(e.currentTarget as HTMLButtonElement).style.color = C.textPrimary
    ;(e.currentTarget as HTMLButtonElement).style.background = C.cardBorderHover
  }
  const btnLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    ;(e.currentTarget as HTMLButtonElement).style.color = C.textSecondary
    ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
  }

  return (
    <div
      className="absolute bottom-4 left-4 flex items-center gap-0.5 rounded-lg z-20 px-1 py-1"
      style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}
    >
      <button
        className={btnCls}
        style={btnStyle}
        onMouseEnter={btnHover} onMouseLeave={btnLeave}
        onClick={() => setZoom(Math.max(MIN_ZOOM, parseFloat((zoom - ZOOM_STEP).toFixed(1))))}
        title="Zoom out"
      >
        <ZoomOut size={13} />
      </button>

      <button
        className="text-xs tabular-nums px-1.5 rounded transition-colors"
        style={{ color: C.textSecondary, minWidth: 42, textAlign: 'center' }}
        onMouseEnter={btnHover} onMouseLeave={btnLeave}
        onClick={() => setZoom(1)}
        title="Reset zoom"
      >
        {Math.round(zoom * 100)}%
      </button>

      <button
        className={btnCls}
        style={btnStyle}
        onMouseEnter={btnHover} onMouseLeave={btnLeave}
        onClick={() => setZoom(Math.min(MAX_ZOOM, parseFloat((zoom + ZOOM_STEP).toFixed(1))))}
        title="Zoom in"
      >
        <ZoomIn size={13} />
      </button>

      <div className="w-px h-4 mx-0.5" style={{ background: C.cardBorder }} />

      <button
        className={btnCls}
        style={btnStyle}
        onMouseEnter={btnHover} onMouseLeave={btnLeave}
        onClick={() => setZoom(1)}
        title="Reset zoom"
      >
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
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden relative"
      style={{
        backgroundColor: C.canvasBg,
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      {/* Zoomed content */}
      <div style={{ zoom, transformOrigin: 'top center' }}>
        <div className="flex flex-col items-center py-10 px-6 min-h-full">

          {/* ── Data Sources ──────────────────────────────────────── */}
          {dataSources.length > 0 && (
            <div className="w-full max-w-md mb-1">
              <p className="text-xs uppercase tracking-widest font-medium mb-3 flex items-center gap-2"
                 style={{ color: C.textSecondary, letterSpacing: '0.1em' }}>
                <Database size={11} /> Data Sources
              </p>
              <div className="flex flex-wrap gap-2">
                {dataSources.map((ds) => {
                  const active = selectedSourceId === ds.id
                  return (
                    <button
                      key={ds.id}
                      onClick={() => onSourceClick(ds.id)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: active ? 'rgba(16,185,129,0.12)' : C.cardBg,
                        border: `1px solid ${active ? '#10b981' : C.cardBorder}`,
                        color: active ? '#34d399' : '#94a3b8',
                        boxShadow: active ? '0 0 0 1px rgba(16,185,129,0.2)' : 'none',
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: '#10b981' }} />
                      <span className="font-mono">{ds.slug}</span>
                      {ds.row_count != null && (
                        <span style={{ color: active ? '#6ee7b7' : C.textSecondary }}>
                          {ds.row_count.toLocaleString()} rows
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Connector: sources → first node */}
          {dataSources.length > 0 && nodes.length > 0 && (
            <Connector showDot />
          )}

          {/* ── Empty state ────────────────────────────────────────── */}
          {nodes.length === 0 && (
            <div className="flex flex-col items-center gap-4 mt-6">
              <AddButton onClick={() => openAddDialog(-1)} />
              <p className="text-xs" style={{ color: C.textSecondary }}>Add your first step</p>
            </div>
          )}

          {/* ── Nodes ─────────────────────────────────────────────── */}
          <div className="w-full max-w-md flex flex-col items-center">
            {nodes.map((node, index) => {
              const isSelected = selectedNodeId === node.id
              const status = node.data.runStatus as string | undefined

              const borderColor = isSelected
                ? C.cardBorderSel
                : status === 'failed'  ? C.cardBorderFail
                : status === 'success' ? C.cardBorderOk
                : C.cardBorder

              const boxShadow = isSelected
                ? '0 0 0 1px rgba(37,99,235,0.3), 0 4px 24px rgba(37,99,235,0.15)'
                : status === 'success'
                ? '0 0 0 1px rgba(20,83,45,0.4)'
                : status === 'failed'
                ? '0 0 0 1px rgba(127,29,29,0.4)'
                : 'none'

              return (
                <React.Fragment key={node.id}>
                  {/* ── Node card ──────────────────────────────────── */}
                  <div
                    onClick={() => handleNodeClick(node.id)}
                    className="w-full rounded-xl cursor-pointer transition-all group"
                    style={{
                      background: C.cardBg,
                      border: `1px solid ${borderColor}`,
                      boxShadow,
                    }}
                    onMouseEnter={e => {
                      if (!isSelected)
                        (e.currentTarget as HTMLDivElement).style.borderColor = C.cardBorderHover
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = borderColor
                    }}
                  >
                    <div className="px-4 py-3 flex items-center gap-3">
                      {/* Step number */}
                      <span className="text-xs font-mono w-4 text-right flex-shrink-0"
                            style={{ color: C.textSecondary }}>
                        {index + 1}
                      </span>

                      {/* Status icon */}
                      <StatusIcon status={status} />

                      {/* Labels */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: C.textPrimary }}>
                          {node.data.label}
                        </p>
                        <p className="text-xs font-mono mt-0.5" style={{ color: C.textSecondary }}>
                          {node.data.slug}
                        </p>
                      </div>

                      {/* Row count badge */}
                      {node.data.rowCount != null && (
                        <span className="text-xs tabular-nums flex-shrink-0 px-2 py-0.5 rounded-full"
                              style={{ color: '#34d399', background: 'rgba(16,185,129,0.1)',
                                       border: '1px solid rgba(16,185,129,0.2)' }}>
                          {(node.data.rowCount as number).toLocaleString()} rows
                        </span>
                      )}

                      {/* Error snippet */}
                      {node.data.errorMessage && (
                        <span className="text-xs text-red-400 truncate max-w-[110px] flex-shrink-0"
                              title={node.data.errorMessage as string}>
                          {node.data.errorMessage}
                        </span>
                      )}

                      {/* Delete — reveal on hover */}
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(node.id) }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all flex-shrink-0"
                        style={{ color: C.textSecondary }}
                        onMouseEnter={e => {
                          ;(e.currentTarget as HTMLButtonElement).style.color = '#f87171'
                          ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'
                        }}
                        onMouseLeave={e => {
                          ;(e.currentTarget as HTMLButtonElement).style.color = C.textSecondary
                          ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                        }}
                        title="Delete step"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* SQL preview strip */}
                    <div className="px-4 pb-3 pl-11">
                      {node.data.sql ? (
                        <p className="text-xs font-mono truncate" style={{ color: C.textSecondary }}>
                          {(node.data.sql as string).replace(/\s+/g, ' ').slice(0, 90)}
                          {(node.data.sql as string).length > 90 ? '…' : ''}
                        </p>
                      ) : (
                        <p className="text-xs italic" style={{ color: C.textMuted }}>
                          No SQL yet — click to configure
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Connector + add button ──────────────────────── */}
                  <div className="flex flex-col items-center my-0.5">
                    <Connector showDot />
                    <AddButton onClick={() => openAddDialog(index)} />
                    {index < nodes.length - 1 && <Connector showDot />}
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Zoom controls overlay ──────────────────────────────────── */}
      <ZoomControls zoom={zoom} setZoom={setZoom} />

      {/* ── Add step dialog ────────────────────────────────────────── */}
      {pendingInsertAfter !== null && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
          <div className="rounded-xl shadow-2xl p-6 w-80"
               style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
            <p className="text-sm font-semibold mb-4" style={{ color: C.textPrimary }}>
              Name this step
            </p>
            <input
              autoFocus
              value={newNodeLabel}
              onChange={e => setNewNodeLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmAddNode()
                if (e.key === 'Escape') { setPendingInsertAfter(null); setNewNodeLabel('') }
              }}
              placeholder="e.g. Filter paid invoices"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none mb-4"
              style={{
                background: C.canvasBg, border: `1px solid ${C.cardBorderHover}`,
                color: C.textPrimary,
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setPendingInsertAfter(null); setNewNodeLabel('') }}
                className="text-sm px-4 py-2 rounded-lg transition-colors"
                style={{ color: C.textSecondary }}
                onMouseEnter={e => (e.currentTarget.style.background = C.cardBorder)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Cancel
              </button>
              <button
                onClick={confirmAddNode}
                disabled={!newNodeLabel.trim()}
                className="text-sm text-white px-4 py-2 rounded-lg transition-opacity disabled:opacity-40"
                style={{ background: '#2563eb' }}
              >
                Add step
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation dialog ─────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
          <div className="rounded-xl shadow-2xl p-6 w-80"
               style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
            <p className="text-sm font-semibold mb-1" style={{ color: C.textPrimary }}>
              Delete this step?
            </p>
            <p className="text-xs mb-5" style={{ color: C.textSecondary }}>
              The step and its SQL will be removed permanently.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="text-sm px-4 py-2 rounded-lg transition-colors"
                style={{ color: C.textSecondary }}
                onMouseEnter={e => (e.currentTarget.style.background = C.cardBorder)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteNode(confirmDeleteId)}
                className="text-sm text-white px-4 py-2 rounded-lg"
                style={{ background: '#dc2626' }}
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
