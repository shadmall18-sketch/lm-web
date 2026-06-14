'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()

  const handleReset = async () => {
    setError('')
    if (!password || password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setSubmitting(false) }
    else { setDone(true); setTimeout(() => router.push('/dashboard'), 2000) }
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="text-5xl font-black text-[#6366F1] mb-2">LM</div>
          <div className="text-xl font-semibold text-[#F1F5F9]">Set New Password</div>
        </div>
        <div className="bg-[#1E293B] rounded-2xl p-8 border border-[#334155] space-y-4">
          {done ? (
            <div className="text-green-400 text-center py-4">
              ✅ Password updated! Redirecting...
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1.5">New Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1.5">Confirm Password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]" onKeyDown={e => e.key === 'Enter' && handleReset()} />
              </div>
              {error && <div className="text-red-400 text-sm bg-red-900/20 rounded-lg px-4 py-3">{error}</div>}
              <button onClick={handleReset} disabled={submitting} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50">
                {submitting ? 'Updating...' : 'Update Password'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
