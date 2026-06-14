'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push('/dashboard')
      else setLoading(false)
    })
  }, [])

  const handleSignIn = async () => {
    setError('')
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setSubmitting(false) }
    else router.push('/dashboard')
  }

  const handleSignUp = async () => {
    setError('')
    setSubmitting(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName, family_name: familyName, role: 'admin' } }
    })
    if (error) { setError(error.message); setSubmitting(false) }
    else router.push('/dashboard')
  }

  const handleReset = async () => {
    if (!email) { setError('Please enter your email address.'); return }
    setError('')
    setSubmitting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://lm-web-two.vercel.app/reset-password',
    })
    if (error) { setError(error.message) }
    else { setResetSent(true) }
    setSubmitting(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
      <div className="text-[#6366F1] text-4xl font-black">LM</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="text-7xl font-black text-[#6366F1] mb-2">LM</div>
          <div className="text-xl font-semibold text-[#F1F5F9]">Life Management</div>
          <div className="text-[#64748B] mt-1">Your family. Organized.</div>
        </div>

        <div className="bg-[#1E293B] rounded-2xl p-8 border border-[#334155]">

          {mode !== 'reset' && (
            <div className="flex bg-[#0F172A] rounded-xl p-1 mb-6">
              <button onClick={() => { setMode('signin'); setError('') }} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'signin' ? 'bg-[#6366F1] text-white' : 'text-[#64748B]'}`}>Sign In</button>
              <button onClick={() => { setMode('signup'); setError('') }} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'signup' ? 'bg-[#6366F1] text-white' : 'text-[#64748B]'}`}>Create Family</button>
            </div>
          )}

          {mode === 'reset' && (
            <div className="mb-6">
              <button onClick={() => { setMode('signin'); setError(''); setResetSent(false) }} className="text-[#64748B] text-sm hover:text-[#F1F5F9] transition-all">← Back to Sign In</button>
              <h2 className="text-lg font-bold text-[#F1F5F9] mt-3">Reset Password</h2>
              <p className="text-sm text-[#64748B] mt-1">Enter your email and we'll send you a reset link.</p>
            </div>
          )}

          <div className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1.5">Family Name</label>
                  <input value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="The Johnson Family" className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1.5">Your Name</label>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Sarah" className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]" />
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]" />
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Password</label>
                  {mode === 'signin' && (
                    <button onClick={() => { setMode('reset'); setError(''); setResetSent(false) }} className="text-xs text-[#6366F1] hover:underline">
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]"
                  onKeyDown={e => e.key === 'Enter' && (mode === 'signin' ? handleSignIn() : handleSignUp())}
                />
              </div>
            )}

            {error && <div className="text-red-400 text-sm bg-red-900/20 rounded-lg px-4 py-3">{error}</div>}

            {resetSent ? (
              <div className="text-green-400 text-sm bg-green-900/20 rounded-lg px-4 py-3 text-center">
                ✅ Check your email for a password reset link.
              </div>
            ) : (
              <button
                onClick={mode === 'signin' ? handleSignIn : mode === 'signup' ? handleSignUp : handleReset}
                disabled={submitting}
                className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 mt-2"
              >
                {submitting
                  ? 'Loading...'
                  : mode === 'signin'
                  ? 'Sign In'
                  : mode === 'signup'
                  ? 'Create Family'
                  : 'Send Reset Link'
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
