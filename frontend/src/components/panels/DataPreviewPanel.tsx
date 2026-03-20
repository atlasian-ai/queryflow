/**
 * Bottom panel — AG Grid showing the selected node's output rows.
 */
import { useEffect, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { getNodeData, getDownloadUrl } from '@/lib/api'
import { usePipelineStore } from '@/store/usePipelineStore'

ModuleRegistry.registerModules([AllCommunityModule])

interface Props {
  pipelineId: string
}

export default function DataPreviewPanel({ pipelineId }: Props) {
  const { selectedNodeId, activeRunId, nodeResults } = usePipelineStore()

  const nodeResult = selectedNodeId ? nodeResults[selectedNodeId] : null
  const canPreview = nodeResult?.status === 'success' && activeRunId && selectedNodeId

  const { data, isLoading } = useQuery({
    queryKey: ['node-data', activeRunId, selectedNodeId],
    queryFn: () => getNodeData(activeRunId!, selectedNodeId!),
    enabled: Boolean(canPreview),
  })

  const colDefs = useMemo(() => {
    if (!data?.column_schema) return []
    return data.column_schema.map((col: { name: string; dtype: string }) => ({
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
  }, [data?.column_schema])

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

  if (isLoading) {
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
          {data?.rows && data.rows.length < (nodeResult.row_count ?? 0) && (
            <span className="text-xs text-slate-400">(showing first {data.rows.length})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={getDownloadUrl(activeRunId, selectedNodeId, 'csv')}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-2 py-1 border rounded hover:bg-white"
          >
            <Download size={12} /> CSV
          </a>
          <a
            href={getDownloadUrl(activeRunId, selectedNodeId, 'xlsx')}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-2 py-1 border rounded hover:bg-white"
          >
            <Download size={12} /> Excel
          </a>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 ag-theme-alpine overflow-hidden">
        <AgGridReact
          rowData={data?.rows ?? []}
          columnDefs={colDefs}
          rowHeight={28}
          headerHeight={32}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          animateRows={false}
        />
      </div>
    </div>
  )
}
