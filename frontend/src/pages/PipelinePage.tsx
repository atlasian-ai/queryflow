/**
 * Main pipeline editing page — linear vertical flow.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Save, Play, Square, Database, Loader2 } from 'lucide-react'
import QueryFlowLogo from '@/components/QueryFlowLogo'
import { getPipeline, savePipeline, triggerRun, getRun, cancelRun, listSources } from '@/lib/api'
import { usePipelineStore } from '@/store/usePipelineStore'
import type { PipelineDetail, RunDetail, DataSource } from '@/types'
import LinearPipelineCanvas from '@/components/canvas/LinearPipelineCanvas'
import NodeConfigPanel from '@/components/panels/NodeConfigPanel'
import DataPreviewPanel from '@/components/panels/DataPreviewPanel'
import RunStatusPanel from '@/components/panels/RunStatusPanel'

const POLL_INTERVAL_MS = 1500
const STEP_HEIGHT = 120

export default function PipelinePage() {
  const { pipelineId } = useParams<{ pipelineId: string }>()
  const [bottomTab, setBottomTab] = useState<'preview' | 'log'>('preview')
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [rightPanelWidth, setRightPanelWidth] = useState(320)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [runSummary, setRunSummary] = useState<{ succeeded: number; failed: number; durationMs: number } | null>(null)
  const runStartRef = useRef<number | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDraggingPanel = useRef(false)

  const {
    nodes, edges,
    selectedNodeId, isDirty,
    setPipeline, loadFromDB, setDirty,
    setActiveRun, applyRunResult,
    activeRunId,
  } = usePipelineStore()

  // Load pipeline
  const { data: pipeline, isLoading } = useQuery<PipelineDetail>({
    queryKey: ['pipeline', pipelineId],
    queryFn: () => getPipeline(pipelineId!),
    enabled: Boolean(pipelineId),
  })

  // Load all data sources
  const { data: dataSources = [] } = useQuery<DataSource[]>({
    queryKey: ['sources'],
    queryFn: listSources,
  })

  useEffect(() => {
    if (!pipeline) return
    setPipeline(pipeline.id, pipeline.name)
    setNameValue(pipeline.name)
    loadFromDB(pipeline.nodes, pipeline.edges)
  }, [pipeline?.id])

  // ── Pipeline rename ──────────────────────────────────────────────
  const handleNameBlur = useCallback(async () => {
    setEditingName(false)
    if (!pipelineId || !nameValue.trim() || nameValue === pipeline?.name) return
    setPipeline(pipelineId, nameValue.trim())
    try { await savePipeline(pipelineId, { name: nameValue.trim() }) } catch { /* silent */ }
  }, [pipelineId, nameValue, pipeline?.name, setPipeline])

  // ── Resizable right panel ────────────────────────────────────────
  const onPanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingPanel.current = true
    const startX = e.clientX
    const startWidth = rightPanelWidth
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingPanel.current) return
      setRightPanelWidth(Math.max(240, Math.min(600, startWidth + (startX - e.clientX))))
    }
    const onMouseUp = () => {
      isDraggingPanel.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [rightPanelWidth])

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!pipelineId) return
    setSaving(true)
    setSaveError('')
    try {
      await savePipeline(pipelineId, {
        nodes: nodes.map((n, index) => ({
          id: n.id,
          label: n.data.label,
          slug: n.data.slug,
          node_type: n.data.node_type,
          data_source_id: n.data.data_source_id,
          prompt: n.data.prompt,
          sql: n.data.sql,
          position_x: 0,
          position_y: index * STEP_HEIGHT, // encode order as y-position
        })),
        // Edges are derived from linear order
        edges: nodes.slice(0, -1).map((n, i) => ({
          id: `e-${n.id}-${nodes[i + 1].id}`,
          source_node_id: n.id,
          target_node_id: nodes[i + 1].id,
        })),
      })
      setDirty(false)
    } catch (e: unknown) {
      const detail =
        (e as any)?.response?.data?.detail ||
        (e instanceof Error ? e.message : null)
      setSaveError(detail ? `Save failed: ${detail}` : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [pipelineId, nodes, setDirty])

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  // ── Run ──────────────────────────────────────────────────────────
  const pollRun = useCallback(async (runId: string) => {
    try {
      const run: RunDetail = await getRun(runId)
      applyRunResult(run)
      if (run.status === 'success' || run.status === 'failed' || run.status === 'cancelled') {
        setRunning(false)
        setBottomTab('preview')
        // Build completion summary
        if (run.status !== 'cancelled') {
          const durationMs = runStartRef.current ? Date.now() - runStartRef.current : 0
          const succeeded = run.node_results.filter((nr) => nr.status === 'success').length
          const failed = run.node_results.filter((nr) => nr.status === 'failed').length
          setRunSummary({ succeeded, failed, durationMs })
        }
        return
      }
    } catch { /* keep polling */ }
    pollTimerRef.current = setTimeout(() => pollRun(runId), POLL_INTERVAL_MS)
  }, [applyRunResult])

  const handleRun = useCallback(async () => {
    if (!pipelineId) return
    await handleSave()
    setRunning(true)
    setBottomTab('log')
    runStartRef.current = Date.now()
    try {
      const run = await triggerRun(pipelineId)
      setActiveRun(run.id)
      pollTimerRef.current = setTimeout(() => pollRun(run.id), POLL_INTERVAL_MS)
    } catch (e: unknown) {
      setRunning(false)
      setSaveError(e instanceof Error ? e.message : 'Failed to start run')
    }
  }, [pipelineId, handleSave, setActiveRun, pollRun])

  const handleStop = useCallback(async () => {
    if (!activeRunId) return
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    try { await cancelRun(activeRunId) } catch { /* ignore */ }
    setRunning(false)
    setActiveRun(null)
  }, [activeRunId, setActiveRun])

  useEffect(() => () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current) }, [])

  // ── Node / source selection ───────────────────────────────────────
  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedSourceId(null)
    setBottomTab('preview')
  }, [])

  const handleSourceClick = useCallback((sourceId: string) => {
    setSelectedSourceId(sourceId)
    usePipelineStore.getState().setSelectedNode(null)
    setBottomTab('preview')
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin mr-2" /> Loading pipeline...
      </div>
    )
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b px-3 sm:px-4 py-2 flex flex-wrap items-center gap-2 flex-shrink-0">
        <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors group flex-shrink-0">
          <QueryFlowLogo size={26} idSuffix="pipeline-header" />
          <span className="hidden sm:block font-bold text-sm text-slate-700 tracking-tight group-hover:text-slate-900">
            Dato<span className="text-blue-600">pia</span>
          </span>
        </Link>
        <span className="text-slate-300 text-lg font-light select-none">/</span>

        {editingName ? (
          <input
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNameBlur(); if (e.key === 'Escape') setEditingName(false) }}
            className="font-semibold text-slate-900 text-sm border-b border-blue-500 focus:outline-none bg-transparent min-w-0"
          />
        ) : (
          <button
            onClick={() => { setEditingName(true); setNameValue(pipeline?.name ?? '') }}
            className="font-semibold text-slate-900 text-sm hover:text-blue-600 transition-colors truncate max-w-[180px] sm:max-w-none"
            title="Click to rename"
          >
            {pipeline?.name}
          </button>
        )}

        {isDirty && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded flex-shrink-0">Unsaved</span>}
        <div className="flex-1" />

        <Link
          to="/sources"
          className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 border rounded hover:bg-slate-50 flex-shrink-0"
        >
          <Database size={13} /> Data Sources
        </Link>

        {saveError && <span className="text-xs text-red-600 hidden sm:block flex-shrink-0">{saveError}</span>}

        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border rounded hover:bg-slate-50 disabled:opacity-40 flex-shrink-0"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          <span className="hidden sm:inline">Save</span>
        </button>

        {running ? (
          <button
            onClick={handleStop}
            className="flex items-center gap-1.5 text-xs bg-red-600 text-white px-3 sm:px-4 py-1.5 rounded hover:bg-red-700 font-medium flex-shrink-0"
          >
            <Square size={13} /> <span className="hidden sm:inline">Stop</span>
          </button>
        ) : (
          <button
            onClick={handleRun}
            disabled={nodes.length === 0}
            className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 sm:px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 font-medium flex-shrink-0"
          >
            <Play size={13} /> <span className="hidden sm:inline">Run</span>
          </button>
        )}
      </header>

      {/* Save error bar (mobile) */}
      {saveError && (
        <div className="sm:hidden bg-red-50 border-b border-red-200 px-4 py-1.5 text-xs text-red-600">
          {saveError}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Canvas + bottom panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Linear canvas */}
          <div className="flex-1 min-h-0 flex">
            <LinearPipelineCanvas
              onNodeClick={handleNodeClick}
              onSourceClick={handleSourceClick}
              dataSources={dataSources}
              selectedSourceId={selectedSourceId}
            />
          </div>

          {/* Bottom panel */}
          <div className="h-44 sm:h-56 border-t bg-white flex flex-col flex-shrink-0">
            <div className="flex border-b bg-slate-50">
              {(['preview', 'log'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setBottomTab(tab)}
                  className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                    bottomTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'preview' ? 'Data Preview' : 'Run Log'}
                </button>
              ))}
              {bottomTab === 'preview' && (selectedNode || selectedSourceId) && (
                <span className="ml-auto px-4 py-2 text-xs text-slate-400 self-center truncate max-w-[120px] sm:max-w-none">
                  {selectedNode
                    ? selectedNode.data.label
                    : dataSources.find((d) => d.id === selectedSourceId)?.slug
                  }
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {bottomTab === 'preview'
                ? <DataPreviewPanel pipelineId={pipelineId!} previewSourceId={selectedSourceId} />
                : <RunStatusPanel />
              }
            </div>
          </div>
        </div>

        {/* Right panel — node config */}
        {selectedNodeId && (
          <>
            {/* Resize handle (desktop only) */}
            <div
              onMouseDown={onPanelResizeStart}
              className="hidden md:block w-1 cursor-col-resize bg-slate-200 hover:bg-blue-400 transition-colors flex-shrink-0"
            />
            <div
              style={{ width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : rightPanelWidth }}
              className="border-t md:border-t-0 md:border-l bg-white flex flex-col flex-shrink-0 overflow-hidden
                         md:max-h-full max-h-64"
            >
              <NodeConfigPanel nodeId={selectedNodeId} pipelineId={pipelineId!} />
            </div>
          </>
        )}
      </div>

      {/* ── Run completion summary dialog ─────────────────────────── */}
      {runSummary && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-7 w-80 text-center">
            {/* Icon */}
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              runSummary.failed === 0 ? 'bg-green-100' : 'bg-amber-100'
            }`}>
              {runSummary.failed === 0
                ? <span className="text-3xl">✓</span>
                : <span className="text-3xl">⚠</span>
              }
            </div>

            <h3 className={`text-lg font-bold mb-1 ${runSummary.failed === 0 ? 'text-green-700' : 'text-amber-700'}`}>
              {runSummary.failed === 0 ? 'Pipeline complete!' : 'Completed with errors'}
            </h3>

            {/* Stats */}
            <div className="flex justify-center gap-6 my-5">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">{runSummary.succeeded}</p>
                <p className="text-xs text-slate-500 mt-0.5">step{runSummary.succeeded !== 1 ? 's' : ''} passed</p>
              </div>
              {runSummary.failed > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{runSummary.failed}</p>
                  <p className="text-xs text-slate-500 mt-0.5">step{runSummary.failed !== 1 ? 's' : ''} failed</p>
                </div>
              )}
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">
                  {runSummary.durationMs < 1000
                    ? `${runSummary.durationMs}ms`
                    : `${(runSummary.durationMs / 1000).toFixed(1)}s`
                  }
                </p>
                <p className="text-xs text-slate-500 mt-0.5">total time</p>
              </div>
            </div>

            <button
              onClick={() => setRunSummary(null)}
              className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
