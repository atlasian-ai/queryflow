export interface User {
  id: string
  supabase_id: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  created_at: string
}

export interface DataSource {
  id: string
  user_id: string
  name: string
  slug: string
  file_type: string
  row_count: number | null
  column_schema: ColumnDef[] | null
  size_bytes: number | null
  created_at: string
}

export interface ColumnDef {
  name: string
  dtype: string
}

export interface PipelineFolder {
  id: string
  user_id: string
  name: string
  emoji: string
  created_at: string
  updated_at: string
}

export interface Pipeline {
  id: string
  user_id: string
  name: string
  description: string | null
  emoji: string | null
  folder_id: string | null
  canvas_state: object
  created_at: string
  updated_at: string
}

export interface PipelineNode {
  id: string
  pipeline_id: string
  label: string
  slug: string
  node_type: 'source' | 'transform'
  data_source_id: string | null
  prompt: string | null
  sql: string | null
  position_x: number | null
  position_y: number | null
  created_at: string
  updated_at: string
}

export interface PipelineEdge {
  id: string
  pipeline_id: string
  source_node_id: string
  target_node_id: string
}

export interface PipelineDetail extends Pipeline {
  nodes: PipelineNode[]
  edges: PipelineEdge[]
}

export interface PipelineRun {
  id: string
  pipeline_id: string
  triggered_by: string
  status: 'pending' | 'running' | 'success' | 'failed'
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface NodeResult {
  id: string
  run_id: string
  node_id: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  row_count: number | null
  column_schema: ColumnDef[] | null
  preview_rows: Record<string, unknown>[] | null
  error_message: string | null
  execution_ms: number | null
}

export interface RunDetail extends PipelineRun {
  node_results: NodeResult[]
}
