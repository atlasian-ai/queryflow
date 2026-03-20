/**
 * Bottom panel — AG Grid showing either:
 *  - a selected node's run output rows, or
 *  - a data source's raw preview rows (when previewSourceId is set)
 */
import { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { getNodeData, downloadNodeResult, getSourcePreview } from '@/lib/api'
import { usePipelineStore } from '@/store/usePipelineStore'

interface Props {
  pipelineId: string
  previewSourceId?: string | null
}

export default function DataPreviewPanel({ pipelineId: _pipelineId, previewSourceId }: Props) {
  const { selectedNodeId, activeRunId, nodeResults } = usePipelineStore()

  // ── Source preview mode ────────────────────────────────────────────
  const { data: sourceData, isLoading: sourceLoading } = useQuery({
    queryKey: ['source-preview', previewSourceId],
    queryFn: () => getSourcePreview(previewSourceId!),
    enabled: Boolean(previewSourceId),
  })

  // ── Node result mode ───────────────────────────────────────────────
  const nodeResult = selectedNodeId ? nodeResults[selectedNodeId] : null
  const canPreview = nodeResult?.status === 'success' && activeRunId && selectedNodeId

  const { data: nodeData, isLoading: nodeLoading } = useQuery({
    queryKey: ['node-data', activeRunId, selectedNodeId],
    queryFn: () => getNodeData(activeRunId!, selectedNodeId!),
    enabled: Boolean(canPreview) && !previewSourceId,
  })

  // ── Column defs ────────────────────────────────────────────────────
  const sourceColDefs = useMemo(() => {
    if (!sourceData?.column_schema) return []
    return sourceData.column_schema.map((col: { name: string; dtype: string }) => ({
      field: col.name,
      headerName: col.name,
      flex: 1,
      minWidth: 100,
      sortable: true,
      filter: true,
      resizable: true,
      cellStyle: { fontSize: '12px' },
      type: col.dtype === 'INTEGER' || col.dtype === 'FLOAT' ? 'numericColumn' : undefined,
    }))
  }, [sourceData?.column_schema])

  const nodeColDefs = useMemo(() => {
    if (!nodeData?.column_schema) return []
    return nodeData.column_schema.map((col: { name: string; dtype: string }) => ({
      field: col.name,
      headerName: col.name,
      flex: 1,
      minWidth: 100,
      sortable: true,
      filter: true,
      resizable: true,
      cellStyle: { fontSize: '12px' },
      type: col.dtype === 'INTEGER' || col.dtype === 'FLOAT' ? 'numericColumn' : undefined,
    }))
  }, [nodeData?.column_schema])

  // ── Source preview render ──────────────────────────────────────────
  if (previewSourceId) {
    if (sourceLoading) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-slate-400">
          Loading preview...
        </div>
      )
    }
    if (!sourceData) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-slate-400">
          No data available
        </div>
      )
    }
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-2 border-b bg-slate-50 flex-shrink-0">
          <span className="text-xs font-medium text-slate-600">
            {sourceData.row_count?.toLocaleString()} rows
          </span>
          {sourceData.rows && sourceData.rows.length < (sourceData.row_count ?? 0) && (
            <span className="text-xs text-slate-400">(showing first {sourceData.rows.length})</span>
          )}
        </div>
        <div className="flex-1 ag-theme-alpine overflow-hidden">
          <AgGridReact
            rowData={sourceData.rows ?? []}
            columnDefs={sourceColDefs}
            rowHeight={28}
            headerHeight={32}
            defaultColDef={{ sortable: true, filter: true, resizable: true }}
            animateRows={false}
          />
        </div>
      </div>
    )
  }

  // ── Node result render ─────────────────────────────────────────────
  if (!selectedNodeId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Select a node to preview its output
      </div>
    )
  }

  if (!activeRunId || !nodeResult) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Run the pipeline to see data here
      </div>
    )
  }

  if (nodeResult.status === 'failed') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-red-600 font-medium">Node failed</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">{nodeResult.error_message}</p>
        </div>
      </div>
    )
  }

  if (nodeResult.status === 'running' || nodeResult.status === 'pending') {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Executing...
      </div>
    )
  }

  if (nodeLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Loading preview...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-600">
            {nodeResult.row_count?.toLocaleString()} rows
          </span>
          {nodeData?.rows && nodeData.rows.length < (nodeResult.row_count ?? 0) && (
            <span className="text-xs text-slate-400">(showing first {nodeData.rows.length})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadNodeResult(activeRunId, selectedNodeId, 'csv')}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-2 py-1 border rounded hover:bg-white"
          >
            <Download size={12} /> CSV
          </button>
          <button
            onClick={() => downloadNodeResult(activeRunId, selectedNodeId, 'xlsx')}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-2 py-1 border rounded hover:bg-white"
          >
            <Download size={12} /> Excel
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 ag-theme-alpine overflow-hidden">
        <AgGridReact
          rowData={nodeData?.rows ?? []}
          columnDefs={nodeColDefs}
          rowHeight={28}
          headerHeight={32}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          animateRows={false}
        />
      </div>
    </div>
  )
}
