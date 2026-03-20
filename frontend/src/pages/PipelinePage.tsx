/**
 * Main pipeline editing page.
 * Layout: header | canvas + right panel | bottom panel
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Save, Play, Square, ArrowLeft, Database, Loader2 } from 'lucide-react'
import { getPipeline, savePipeline, triggerRun, getRun, cancelRun } from '@/lib/api'
import { usePipelineStore } from '@/store/usePipelineStore'
import type { PipelineDetail, RunDetail } from '@/types'
import PipelineCanvas from '@/components/canvas/PipelineCanvas'
import NodeConfigPanel from '@/components/panels/NodeConfigPanel'
import DataPreviewPanel from '@/components/panels/DataPreviewPanel'
import RunStatusPanel from '@/components/panels/RunStatusPanel'

const POLL_INTERVAL_MS = 1500

export default function PipelinePage() {
  const { pipelineId } = useParams<{ pipelineId: string }>()
  const [bottomTab, setBottomTab] = useState<'preview' | 'log'>('preview')
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [saveError, setSaveError] = useState('')
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    nodes, edges,
    selectedNodeId, isDirty,
    setPipeline, loadFromDB, setDirty,
    setActiveRun, applyRunResult, runStatus,
    activeRunId,
  } = usePipelineStore()

  // Load pipeline from API
  const { data: pipeline, isLoading } = useQuery<PipelineDetail>({
    queryKey: ['pipeline', pipelineId],
    queryFn: () => getPipeline(pipelineId!),
    enabled: Boolean(pipelineId),
  })

  useEffect(() => {
    if (!pipeline) return
    setPipeline(pipeline.id, pipeline.name)
    loadFromDB(pipeline.nodes, pipeline.edges)
  }, [pipeline?.id])

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!pipelineId) return
    setSaving(true)
    setSaveError('')
    try {
      await savePipeline(pipelineId, {
        nodes: nodes.map((n) => ({
          id: n.id,
          label: n.data.label,
          slug: n.data.slug,
          node_type: n.data.node_type,
          data_source_id: n.data.data_source_id,
          prompt: n.data.prompt,
          sql: n.data.sql,
          position_x: n.position.x,
          position_y: n.position.y,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source_node_id: e.source,
          target_node_id: e.target,
        })),
      })
      setDirty(false)
    } catch {
      setSaveError('Save failed')
    } finally {
      setSaving(false)
    }
  }, [pipelineId, nodes, edges, setDirty])

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  // ── Run ─────────────────────────────────────────────────────────────────────
  const pollRun = useCallback(async (runId: string) => {
    try {
      const run: RunDetail = await getRun(runId)
      applyRunResult(run)

      if (run.status === 'success' || run.status === 'failed') {
        setRunning(false)
        setBottomTab('preview')
        return
      }
    } catch {
      // keep polling
    }
    pollTimerRef.current = setTimeout(() => pollRun(runId), POLL_INTERVAL_MS)
  }, [applyRunResult])

  const handleStop = useCallback(async () => {
    if (!activeRunId) return
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    try { await cancelRun(activeRunId) } catch { /* ignore */ }
    setRunning(false)
    setActiveRun(null)
  }, [activeRunId, setActiveRun])

  const handleRun = useCallback(async () => {
    if (!pipelineId) return
    // Save first
    await handleSave()
    setRunning(true)
    setBottomTab('log')
    try {
      const run = await triggerRun(pipelineId)
      setActiveRun(run.id)
      pollTimerRef.current = setTimeout(() => pollRun(run.id), POLL_INTERVAL_MS)
    } catch (e: unknown) {
      setRunning(false)
      const msg = e instanceof Error ? e.message : 'Failed to start run'
      setSaveError(msg)
    }
  }, [pipelineId, handleSave, setActiveRun, pollRun])

  useEffect(() => () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current) }, [])

  // ── Node selection ───────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((nodeId: string) => {
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
      <header className="bg-white border-b px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <Link to="/" className="text-slate-400 hover:text-slate-600"><ArrowLeft size={18} /></Link>
        <span className="font-semibold text-slate-900 text-sm">{pipeline?.name}</span>
        {isDirty && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Unsaved</span>}

        <div className="flex-1" />

        <Link
          to="/sources"
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 border rounded hover:bg-slate-50"
        >
          <Database size={13} /> Data Sources
        </Link>

        {saveError && <span className="text-xs text-red-600">{saveError}</span>}

        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border rounded hover:bg-slate-50 disabled:opacity-40"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save
        </button>

        {running ? (
          <button
            onClick={handleStop}
            className="flex items-center gap-1.5 text-xs bg-red-600 text-white px-4 py-1.5 rounded hover:bg-red-700 font-medium"
          >
            <Square size={13} /> Stop
          </button>
        ) : (
          <button
            onClick={handleRun}
            disabled={nodes.length === 0}
            className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            <Play size={13} /> Run
          </button>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Canvas + bottom panel column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Canvas */}
          <div className="flex-1 min-h-0">
            <PipelineCanvas onNodeClick={handleNodeClick} />
          </div>

          {/* Bottom panel */}
          <div className="h-56 border-t bg-white flex flex-col flex-shrink-0">
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
              {selectedNode && bottomTab === 'preview' && (
                <span className="ml-auto px-4 py-2 text-xs text-slate-400 self-center">
                  {selectedNode.data.label}
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {bottomTab === 'preview'
                ? <DataPreviewPanel pipelineId={pipelineId!} />
                : <RunStatusPanel />
              }
            </div>
          </div>
        </div>

        {/* Right panel — node config */}
        {selectedNodeId && (
          <div className="w-80 border-l bg-white flex flex-col flex-shrink-0 overflow-hidden">
            <NodeConfigPanel nodeId={selectedNodeId} pipelineId={pipelineId!} />
          </div>
        )}
      </div>
    </div>
  )
}
