/**
 * Bottom panel tab — shows per-node run status + timing log.
 */
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'
import { usePipelineStore } from '@/store/usePipelineStore'

const STATUS_ICON = {
  success: <CheckCircle2 size={14} className="text-green-600" />,
  failed: <XCircle size={14} className="text-red-600" />,
  running: <Loader2 size={14} className="text-blue-600 animate-spin" />,
  pending: <Clock size={14} className="text-slate-400" />,
  skipped: <Clock size={14} className="text-slate-300" />,
}

export default function RunStatusPanel() {
  const { nodes, nodeResults, runStatus, activeRunId } = usePipelineStore()

  if (!activeRunId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        No run yet — press Run to execute the pipeline
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-2 border-b bg-slate-50 flex items-center gap-2">
        <span className="text-xs font-medium text-slate-600">Run status:</span>
        <span className={`text-xs font-semibold ${
          runStatus === 'success' ? 'text-green-600' :
          runStatus === 'failed' ? 'text-red-600' :
          runStatus === 'running' ? 'text-blue-600' : 'text-slate-500'
        }`}>
          {runStatus}
        </span>
      </div>

      <div className="divide-y">
        {nodes.map((node) => {
          const nr = nodeResults[node.id]
          const status = nr?.status ?? 'pending'
          return (
            <div key={node.id} className="px-4 py-2.5 flex items-center gap-3">
              {STATUS_ICON[status as keyof typeof STATUS_ICON] ?? STATUS_ICON.pending}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-800 font-medium truncate">{node.data.label}</span>
                  <code className="text-xs text-slate-400 font-mono">{node.data.slug}</code>
                </div>
                {nr?.error_message && (
                  <p className="text-xs text-red-600 mt-0.5 truncate">{nr.error_message}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                {nr?.row_count != null && (
                  <p className="text-xs text-slate-500">{nr.row_count.toLocaleString()} rows</p>
                )}
                {nr?.execution_ms != null && (
                  <p className="text-xs text-slate-400">{nr.execution_ms}ms</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
