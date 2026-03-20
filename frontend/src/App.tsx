import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthInit, useAuthStore } from '@/store/useAuthStore'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import PipelinePage from '@/pages/PipelinePage'
import SourcesPage from '@/pages/SourcesPage'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  useAuthInit()
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AuthGate><DashboardPage /></AuthGate>} />
        <Route path="/pipelines/:pipelineId" element={<AuthGate><PipelinePage /></AuthGate>} />
        <Route path="/sources" element={<AuthGate><SourcesPage /></AuthGate>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
