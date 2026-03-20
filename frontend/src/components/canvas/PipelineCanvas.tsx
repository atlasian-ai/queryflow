/**
 * @xyflow/react canvas — the main pipeline editing surface.
 * Handles node creation (double-click empty space) and edge drawing.
 */
import { useCallback, useRef } from 'react'
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
const nodeTypes: NodeTypes = { transformNode: TransformNode }

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

  // Double-click on canvas to add a new node
  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const wrapper = reactFlowWrapper.current
      if (!wrapper) return

      const rect = wrapper.getBoundingClientRect()
      const label = prompt('Node name:')
      if (!label?.trim()) return

      const slug = generateSlug(label.trim())
      const newNode: Node<NodeData> = {
        id: uuidv4(),
        type: 'transformNode',
        position: { x: event.clientX - rect.left - 100, y: event.clientY - rect.top - 40 },
        data: {
          label: label.trim(),
          slug,
          node_type: 'transform',
          data_source_id: null,
          prompt: null,
          sql: null,
        },
      }
      addNode(newNode)
      setSelectedNode(newNode.id)
      onNodeClick(newNode.id)
    },
    [addNode, setSelectedNode, onNodeClick]
  )

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
        onDoubleClick={onDoubleClick}
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
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-slate-400">
              <p className="text-sm">Double-click anywhere to add a node</p>
              <p className="text-xs mt-1">Drag between nodes to connect them</p>
            </div>
          </div>
        )}
      </ReactFlow>
    </div>
  )
}
