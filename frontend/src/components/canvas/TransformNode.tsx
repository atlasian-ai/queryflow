/**
 * The single node type for the canvas.
 * Shows label, run status badge, row count, and a preview of the SQL.
 */
import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { CheckCircle2, XCircle, Loader2, Clock, Database } from 'lucide-react'
import type { NodeData } from '@/store/usePipelineStore'

export type TransformNodeType = Node<NodeData, 'transformNode'>

const STATUS_CONFIG = {
  success: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  running: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  pending: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200' },
}

function StatusBadge({ status }: { status: NodeData['runStatus'] }) {
  if (!status) return null
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
      <Icon size={10} className={status === 'running' ? 'animate-spin' : ''} />
      {status}
    </span>
  )
}

function TransformNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const hasSql = Boolean(data.sql?.trim())

  return (
    <div
      className={`bg-white rounded-lg border-2 shadow-sm min-w-[200px] max-w-[260px] transition-colors ${
        selected ? 'border-blue-500' : 'border-slate-200'
      }`}
    >
      {/* Input handle */}
      <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white" />

      {/* Header */}
      <div className={`px-3 py-2 border-b flex items-center gap-2 rounded-t-lg ${
        data.node_type === 'source' ? 'bg-emerald-50' : 'bg-slate-50'
      }`}>
        <Database size={12} className={data.node_type === 'source' ? 'text-emerald-600' : 'text-slate-400'} />
        <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{data.label || 'Untitled'}</span>
        <StatusBadge status={data.runStatus} />
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        {/* SQL preview */}
        {hasSql ? (
          <pre className="text-xs text-slate-500 font-mono truncate whitespace-nowrap overflow-hidden">
            {data.sql!.split('\n')[0].slice(0, 35)}{data.sql!.length > 35 ? '…' : ''}
          </pre>
        ) : (
          <p className="text-xs text-slate-400 italic">No SQL yet — click to edit</p>
        )}

        {/* Row count */}
        {data.rowCount != null && (
          <p className="text-xs text-slate-400 mt-1">{data.rowCount.toLocaleString()} rows</p>
        )}

        {/* Error */}
        {data.errorMessage && (
          <p className="text-xs text-red-500 mt-1 truncate" title={data.errorMessage}>
            {data.errorMessage}
          </p>
        )}

        {/* Slug chip */}
        <code className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded mt-1.5 inline-block font-mono">
          {data.slug}
        </code>
      </div>

      {/* Output handle */}
      <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white" />
    </div>
  )
}

export default memo(TransformNode)
