/**
 * @xyflow/react canvas — the main pipeline editing surface.
 * Handles node creation (double-click empty space) and edge drawing.
 */
import React, { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
  type NodeTypes,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { v4 as uuidv4 } from 'uuid'
import { usePipelineStore, type NodeData } from '@/store/usePipelineStore'
import TransformNode from './TransformNode'
import type { Node } from '@xyflow/react'

// Register custom node types
const nodeTypes = { transformNode: TransformNode } as unknown as NodeTypes

function generateSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'node'
}

interface Props {
  onNodeClick: (nodeId: string) => void
}

export default function PipelineCanvas({ onNodeClick }: Props) {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange,
    addNode, setSelectedNode,
  } = usePipelineStore()

  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  const onConnect = useCallback(
    (connection: Connection) => {
      const edge: Edge = { ...connection, id: uuidv4() } as Edge
      usePipelineStore.getState().onEdgesChange([{ type: 'add', item: edge }])
    },
    []
  )

  const onNodeClickHandler = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      setSelectedNode(node.id)
      onNodeClick(node.id)
    },
    [setSelectedNode, onNodeClick]
  )

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [setSelectedNode])

  const [pendingNode, setPendingNode] = React.useState<{ position: { x: number; y: number } } | null>(null)
  const [newNodeLabel, setNewNodeLabel] = React.useState('')

  // Double-click on pane to add a new node
  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const wrapper = reactFlowWrapper.current
      if (!wrapper) return
      const rect = wrapper.getBoundingClientRect()
      setPendingNode({ position: { x: event.clientX - rect.left - 100, y: event.clientY - rect.top - 40 } })
      setNewNodeLabel('')
    },
    []
  )

  const confirmNewNode = useCallback(() => {
    if (!pendingNode || !newNodeLabel.trim()) return
    const label = newNodeLabel.trim()
    const slug = generateSlug(label)
    const newNode: Node<NodeData> = {
      id: uuidv4(),
      type: 'transformNode',
      position: pendingNode.position,
      data: { label, slug, node_type: 'transform', data_source_id: null, prompt: null, sql: null },
    }
    addNode(newNode)
    setSelectedNode(newNode.id)
    onNodeClick(newNode.id)
    setPendingNode(null)
    setNewNodeLabel('')
  }, [pendingNode, newNodeLabel, addNode, setSelectedNode, onNodeClick])

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClickHandler}
        onPaneClick={onPaneClick}
        onPaneDoubleClick={onPaneDoubleClick}
        fitView
        deleteKeyCode="Delete"
        minZoom={0.3}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const data = n.data as NodeData
            if (data?.runStatus === 'success') return '#16a34a'
            if (data?.runStatus === 'failed') return '#dc2626'
            if (data?.runStatus === 'running') return '#2563eb'
            return '#94a3b8'
          }}
          className="!border !border-slate-200 !rounded-lg"
        />

        {/* Canvas hint */}
        {nodes.length === 0 && !pendingNode && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-slate-400">
              <p className="text-sm">Double-click anywhere to add a node</p>
              <p className="text-xs mt-1">Drag between nodes to connect them</p>
            </div>
          </div>
        )}

        {/* New node name dialog */}
        {pendingNode && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/10">
            <div className="bg-white rounded-lg shadow-lg border p-5 w-72">
              <p className="text-sm font-medium text-slate-800 mb-3">Name this node</p>
              <input
                autoFocus
                value={newNodeLabel}
                onChange={(e) => setNewNodeLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmNewNode(); if (e.key === 'Escape') setPendingNode(null) }}
                placeholder="e.g. Filter invoices"
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setPendingNode(null)} className="text-sm text-slate-500 px-3 py-1.5 hover:bg-slate-100 rounded">Cancel</button>
                <button onClick={confirmNewNode} className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700">Add node</button>
              </div>
            </div>
          </div>
        )}
      </ReactFlow>
    </div>
  )
}
