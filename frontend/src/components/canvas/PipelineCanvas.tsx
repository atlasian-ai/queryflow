/**
 * @xyflow/react canvas — the main pipeline editing surface.
 * Handles node creation (double-click empty space) and edge drawing.
 */
import React, { useCallback, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { v4 as uuidv4 } from 'uuid'
import { usePipelineStore, type NodeData } from '@/store/usePipelineStore'
import TransformNode from './TransformNode'
import type { Node } from '@xyflow/react'

const nodeTypes = { transformNode: TransformNode } as unknown as NodeTypes

function generateSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'node'
}

/** Offset position until it doesn't overlap any existing node */
function findNonOverlappingPosition(
  pos: { x: number; y: number },
  existingNodes: Node[]
): { x: number; y: number } {
  const W = 240, H = 90, MARGIN = 24
  let result = { ...pos }
  for (let attempt = 0; attempt < 10; attempt++) {
    const overlaps = existingNodes.some(
      (n) =>
        Math.abs(n.position.x - result.x) < W + MARGIN &&
        Math.abs(n.position.y - result.y) < H + MARGIN
    )
    if (!overlaps) break
    result = { x: result.x + W + MARGIN, y: result.y }
    if (attempt % 3 === 2) result = { x: pos.x, y: result.y + H + MARGIN }
  }
  return result
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
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const [pendingNode, setPendingNode] = useState<{ position: { x: number; y: number } } | null>(null)
  const [newNodeLabel, setNewNodeLabel] = useState('')

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

  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement
      const isPane =
        target.classList.contains('react-flow__pane') ||
        target.classList.contains('react-flow__background') ||
        target.closest('.react-flow__pane') !== null
      if (!isPane) return

      let position: { x: number; y: number }
      if (rfInstance) {
        position = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      } else {
        const wrapper = reactFlowWrapper.current
        if (!wrapper) return
        const rect = wrapper.getBoundingClientRect()
        position = { x: event.clientX - rect.left - 100, y: event.clientY - rect.top - 40 }
      }

      const safePosition = findNonOverlappingPosition(position, nodes)
      setPendingNode({ position: safePosition })
      setNewNodeLabel('')
    },
    [rfInstance, nodes]
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
    <div
      ref={reactFlowWrapper}
      className="w-full h-full"
      style={{ background: '#111827' }}
      onDoubleClickCapture={onPaneDoubleClick}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClickHandler}
        onPaneClick={onPaneClick}
        onInit={setRfInstance}
        fitView
        deleteKeyCode="Delete"
        minZoom={0.3}
        maxZoom={2}
        style={{ background: '#111827' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="#374151"
        />
        <Controls className="!bg-slate-800 !border-slate-700 [&>button]:!text-slate-300 [&>button]:!border-slate-700" />
        <MiniMap
          nodeColor={(n) => {
            const data = n.data as NodeData
            if (data?.runStatus === 'success') return '#16a34a'
            if (data?.runStatus === 'failed') return '#dc2626'
            if (data?.runStatus === 'running') return '#2563eb'
            return '#4b5563'
          }}
          style={{ background: '#1f2937', border: '1px solid #374151' }}
        />

        {nodes.length === 0 && !pendingNode && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-sm text-slate-500">Double-click anywhere to add a node</p>
              <p className="text-xs mt-1 text-slate-600">Drag between nodes to connect them</p>
            </div>
          </div>
        )}

        {pendingNode && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/30">
            <div className="bg-white rounded-lg shadow-xl border p-5 w-72">
              <p className="text-sm font-medium text-slate-800 mb-3">Name this node</p>
              <input
                autoFocus
                value={newNodeLabel}
                onChange={(e) => setNewNodeLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmNewNode()
                  if (e.key === 'Escape') setPendingNode(null)
                }}
                placeholder="e.g. Filter invoices"
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setPendingNode(null)}
                  className="text-sm text-slate-500 px-3 py-1.5 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmNewNode}
                  className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700"
                >
                  Add node
                </button>
              </div>
            </div>
          </div>
        )}
      </ReactFlow>
    </div>
  )
}
