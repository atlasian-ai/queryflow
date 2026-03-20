/**
 * Zustand store for the active pipeline canvas.
 * Stores nodes/edges in @xyflow/react format + run state.
 */
import { create } from 'zustand'
import { type Node, type Edge, applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from '@xyflow/react'
import type { PipelineNode, PipelineEdge, RunDetail, NodeResult } from '@/types'

export interface NodeData extends Record<string, unknown> {
  label: string
  slug: string
  node_type: 'source' | 'transform'
  data_source_id: string | null
  prompt: string | null
  sql: string | null
  // Run state (injected after a run)
  runStatus?: 'pending' | 'running' | 'success' | 'failed'
  rowCount?: number | null
  errorMessage?: string | null
}

interface PipelineStore {
  pipelineId: string | null
  pipelineName: string
  nodes: Node<NodeData>[]
  edges: Edge[]
  isDirty: boolean
  selectedNodeId: string | null

  // Active run
  activeRunId: string | null
  runStatus: 'idle' | 'pending' | 'running' | 'success' | 'failed'
  nodeResults: Record<string, NodeResult>

  // Actions
  setPipeline: (id: string, name: string) => void
  loadFromDB: (nodes: PipelineNode[], edges: PipelineEdge[]) => void
  onNodesChange: (changes: NodeChange<Node<NodeData>>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  addNode: (node: Node<NodeData>) => void
  insertNodeAfterIndex: (node: Node<NodeData>, afterIndex: number) => void
  removeNode: (nodeId: string) => void
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void
  renameSlugInAllNodes: (exceptNodeId: string, oldSlug: string, newSlug: string) => void
  setSelectedNode: (nodeId: string | null) => void
  setDirty: (dirty: boolean) => void
  setActiveRun: (runId: string | null) => void
  applyRunResult: (run: RunDetail) => void
  resetRunState: () => void
}

export const usePipelineStore = create<PipelineStore>((set, get) => ({
  pipelineId: null,
  pipelineName: '',
  nodes: [],
  edges: [],
  isDirty: false,
  selectedNodeId: null,
  activeRunId: null,
  runStatus: 'idle',
  nodeResults: {},

  setPipeline: (id, name) => set({ pipelineId: id, pipelineName: name }),

  loadFromDB: (dbNodes, _dbEdges) => {
    // Sort by position_y to restore linear order
    const sorted = [...dbNodes].sort((a, b) => (a.position_y ?? 0) - (b.position_y ?? 0))
    const nodes: Node<NodeData>[] = sorted.map((n) => ({
      id: n.id,
      type: 'transformNode',
      position: { x: 0, y: n.position_y ?? 0 },
      data: {
        label: n.label,
        slug: n.slug,
        node_type: n.node_type as 'source' | 'transform',
        data_source_id: n.data_source_id,
        prompt: n.prompt,
        sql: n.sql,
      },
    }))
    // Auto-compute linear edges from order
    const edges: Edge[] = nodes.slice(0, -1).map((n, i) => ({
      id: `e-${n.id}-${nodes[i + 1].id}`,
      source: n.id,
      target: nodes[i + 1].id,
    }))
    set({ nodes, edges, isDirty: false })
  },

  onNodesChange: (changes) =>
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes), isDirty: true })),

  onEdgesChange: (changes) =>
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges), isDirty: true })),

  addNode: (node) => set((state) => {
    const nodes = [...state.nodes, node]
    const edges: Edge[] = nodes.slice(0, -1).map((n, i) => ({
      id: `e-${n.id}-${nodes[i + 1].id}`,
      source: n.id,
      target: nodes[i + 1].id,
    }))
    return { nodes, edges, isDirty: true }
  }),

  insertNodeAfterIndex: (node, afterIndex) => set((state) => {
    const nodes = [...state.nodes]
    nodes.splice(afterIndex + 1, 0, node)
    const edges: Edge[] = nodes.slice(0, -1).map((n, i) => ({
      id: `e-${n.id}-${nodes[i + 1].id}`,
      source: n.id,
      target: nodes[i + 1].id,
    }))
    return { nodes, edges, isDirty: true }
  }),

  removeNode: (nodeId) => set((state) => {
    const nodes = state.nodes.filter((n) => n.id !== nodeId)
    const edges: Edge[] = nodes.slice(0, -1).map((n, i) => ({
      id: `e-${n.id}-${nodes[i + 1].id}`,
      source: n.id,
      target: nodes[i + 1].id,
    }))
    const selectedNodeId = state.selectedNodeId === nodeId ? null : state.selectedNodeId
    return { nodes, edges, selectedNodeId, isDirty: true }
  }),

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
      isDirty: true,
    })),

  renameSlugInAllNodes: (exceptNodeId, oldSlug, newSlug) =>
    set((state) => {
      // Match old slug only when surrounded by non-identifier characters
      const pattern = new RegExp(`(?<![a-z0-9_])${oldSlug}(?![a-z0-9_])`, 'g')
      let changed = false
      const nodes = state.nodes.map((n) => {
        if (n.id === exceptNodeId || !n.data.sql) return n
        const newSql = n.data.sql.replace(pattern, newSlug)
        if (newSql === n.data.sql) return n
        changed = true
        return { ...n, data: { ...n.data, sql: newSql } }
      })
      return changed ? { nodes, isDirty: true } : {}
    }),

  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setActiveRun: (runId) => set({ activeRunId: runId }),

  applyRunResult: (run) => {
    const nodeResults: Record<string, NodeResult> = {}
    for (const nr of run.node_results) {
      nodeResults[nr.node_id] = nr
    }
    set((state) => ({
      runStatus: run.status as 'pending' | 'running' | 'success' | 'failed',
      nodeResults,
      nodes: state.nodes.map((n) => {
        const nr = nodeResults[n.id]
        if (!nr) return n
        return {
          ...n,
          data: {
            ...n.data,
            runStatus: nr.status as NodeData['runStatus'],
            rowCount: nr.row_count,
            errorMessage: nr.error_message,
          },
        }
      }),
    }))
  },

  resetRunState: () =>
    set((state) => ({
      activeRunId: null,
      runStatus: 'idle',
      nodeResults: {},
      nodes: state.nodes.map((n) => ({
        ...n,
        data: { ...n.data, runStatus: undefined, rowCount: undefined, errorMessage: undefined },
      })),
    })),
}))
