import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import QueryFlowLogo from '@/components/QueryFlowLogo'

export default function LoginPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10"
        style={{ background: 'linear-gradient(145deg, #1e3a8a 0%, #1d1250 60%, #0f0a1e 100%)' }}
      >
        <div className="flex items-center gap-3">
          <QueryFlowLogo size={40} idSuffix="login-panel" />
          <span className="text-white font-bold text-xl tracking-tight">
            Query<span className="text-blue-300">Flow</span>
          </span>
        </div>

        <div>
          <p className="text-3xl font-bold text-white leading-snug mb-4">
            Build SQL pipelines<br />
            <span className="text-blue-300">without the complexity.</span>
          </p>
          <p className="text-sm text-blue-200/70 leading-relaxed">
            Describe what you need in plain English — QueryFlow writes the SQL,
            runs it step-by-step, and keeps your data flowing.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              'Natural language → DuckDB SQL',
              'Linear visual pipeline editor',
              'Live data preview at every step',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-blue-100/80">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-blue-300/40">© {new Date().getFullYear()} QueryFlow</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm">
          {/* Logo (mobile only) */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex items-center gap-3">
              <QueryFlowLogo size={44} idSuffix="login-mobile" />
              <span className="text-slate-900 font-bold text-2xl tracking-tight">
                Query<span className="text-blue-600">Flow</span>
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Welcome back</h2>
              <p className="text-sm text-slate-500 mt-1">Sign in to your QueryFlow workspace</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 active:opacity-80 disabled:opacity-50 transition-opacity mt-2"
                style={{ background: 'linear-gradient(135deg, #2563EB, #6D28D9)' }}
              >
                {loading ? 'Please wait…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
