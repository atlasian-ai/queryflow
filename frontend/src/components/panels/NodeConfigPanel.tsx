/**
 * Right panel — shown when a node is selected.
 * Contains: label/slug editor, prompt textarea, Generate SQL button, CodeMirror SQL editor.
 */
import { useState, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import { Wand2, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { generateSQL } from '@/lib/api'
import { usePipelineStore } from '@/store/usePipelineStore'

function generateSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'node'
}

interface Props {
  nodeId: string
  pipelineId: string
}

export default function NodeConfigPanel({ nodeId, pipelineId }: Props) {
  const { nodes, updateNodeData } = usePipelineStore()
  const node = nodes.find((n) => n.id === nodeId)

  const [label, setLabel] = useState(node?.data.label ?? '')
  const [slug, setSlug] = useState(node?.data.slug ?? '')
  const [slugEditing, setSlugEditing] = useState(false)
  const [prompt, setPrompt] = useState(node?.data.prompt ?? '')
  const [sqlValue, setSqlValue] = useState(node?.data.sql ?? '')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [showPrompt, setShowPrompt] = useState(true)

  useEffect(() => {
    if (!node) return
    setLabel(node.data.label)
    setSlug(node.data.slug)
    setPrompt(node.data.prompt ?? '')
    setSqlValue(node.data.sql ?? '')
  }, [nodeId, node?.data.label, node?.data.prompt, node?.data.sql])

  if (!node) return null

  const handleLabelBlur = () => {
    if (label.trim() && label !== node.data.label) {
      const newSlug = generateSlug(label.trim())
      setSlug(newSlug)
      updateNodeData(nodeId, { label: label.trim(), slug: newSlug })
    }
  }

  const handleSlugBlur = () => {
    setSlugEditing(false)
    const cleanSlug = generateSlug(slug)
    setSlug(cleanSlug)
    if (cleanSlug !== node.data.slug) {
      updateNodeData(nodeId, { slug: cleanSlug })
    }
  }

  const handlePromptBlur = () => updateNodeData(nodeId, { prompt })

  const handleSqlChange = (value: string) => {
    setSqlValue(value)
    updateNodeData(nodeId, { sql: value })
  }

  const handleGenerateSQL = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setGenError('')
    try {
      const result = await generateSQL(pipelineId, { prompt, node_id: nodeId })
      setSqlValue(result.sql)
      updateNodeData(nodeId, { sql: result.sql, prompt })
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Failed to generate SQL')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-slate-50 flex-shrink-0">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Node Settings</p>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleLabelBlur}
          className="w-full text-sm font-semibold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none py-0.5 mb-1"
          placeholder="Node label..."
        />
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400">SQL name:</span>
          {slugEditing ? (
            <input
              autoFocus
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              onBlur={handleSlugBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSlugBlur() }}
              className="text-xs font-mono text-blue-600 bg-blue-50 border border-blue-300 rounded px-1 focus:outline-none flex-1"
            />
          ) : (
            <button
              onClick={() => setSlugEditing(true)}
              className="text-xs font-mono text-slate-500 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 px-1.5 py-0.5 rounded transition-colors"
              title="Click to rename SQL table name"
            >
              {slug}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Prompt section */}
        <div className="border-b">
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide hover:bg-slate-50"
          >
            Describe what this step does
            {showPrompt ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showPrompt && (
            <div className="px-4 pb-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onBlur={handlePromptBlur}
                rows={4}
                placeholder="e.g. filter rows where amount > 0, group by vendor and sum the amount, join with accounts on vendor_id..."
                className="w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[80px] text-slate-700 placeholder:text-slate-400"
              />
              {genError && <p className="text-xs text-red-600 mt-1">{genError}</p>}
              <button
                onClick={handleGenerateSQL}
                disabled={generating || !prompt.trim()}
                className="mt-2 flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50 w-full justify-center"
              >
                {generating
                  ? <><Loader2 size={13} className="animate-spin" /> Generating SQL...</>
                  : <><Wand2 size={13} /> Generate SQL</>
                }
              </button>
            </div>
          )}
        </div>

        {/* SQL editor */}
        <div className="flex flex-col">
          <div className="px-4 py-2.5 flex items-center justify-between border-b bg-slate-50 flex-shrink-0">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">SQL (DuckDB)</span>
            <span className="text-xs text-slate-400">Edit directly or generate above</span>
          </div>
          <div
            className="overflow-hidden resize-y"
            style={{ minHeight: '180px', height: '300px' }}
          >
            <CodeMirror
              value={sqlValue}
              onChange={handleSqlChange}
              extensions={[sql()]}
              theme={oneDark}
              height="100%"
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                dropCursor: false,
                allowMultipleSelections: false,
                indentOnInput: true,
              }}
              style={{ fontSize: '12px', height: '100%' }}
            />
          </div>
        </div>

        {/* Available tables hint */}
        <div className="px-4 py-3 border-t bg-slate-50">
          <p className="text-xs text-slate-500 font-medium mb-1">Tip</p>
          <p className="text-xs text-slate-400">
            Reference upstream nodes by their <span className="font-mono bg-slate-200 px-1 rounded">SQL name</span> (shown above).
            Connect nodes on the canvas to make them available as input tables.
          </p>
        </div>
      </div>
    </div>
  )
}
