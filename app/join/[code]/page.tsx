'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState<any>(null)
  const [familyName, setFamilyName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const checkInvite = async () => {
      const { data } = await supabase
        .from('user_invites')
        .select('*, family:families(name)')
        .eq('code', code)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (data) {
        setInvite(data)
        setFamilyName(data.family?.name ?? 'the family')
      }
      setLoading(false)
    }
    checkInvite()
  }, [code])

  const handleJoin = async () => {
    if (!displayName || !password) { setError('Please fill in all fields.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setSubmitting(true); setError('')

    // Create the account server-side (no confirmation email, no rate limit)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const res = await fetch(`${supabaseUrl}/functions/v1/create-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({ code, displayName, password }),
    })
    const result = await res.json()

    if (!result.success) {
      setError(result.error ?? 'Could not create account.')
      setSubmitting(false)
      return
    }

    // Now sign in with the new credentials
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: result.email,
      password,
    })

    if (signInError) { setError(signInError.message); setSubmitting(false); return }
    router.push('/dashboard')
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center">
      <div className="text-[#6366F1] text-4xl font-black">LM</div>
    </div>
  )

  if (!invite) return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="text-5xl font-black text-[#6366F1] mb-4">LM</div>
        <div className="bg-[#1E293B] rounded-2xl p-8 border border-[#334155]">
          <div className="text-xl font-bold text-[#F1F5F9] mb-2">Invite not valid</div>
          <p className="text-[#64748B] text-sm mb-6">This invite link has expired or already been used. Ask the family admin to send a new one.</p>
          <button onClick={() => router.push('/')} className="bg-[#6366F1] text-white font-bold px-6 py-3 rounded-xl">Go to Sign In</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl font-black text-[#6366F1] mb-2">LM</div>
          <div className="text-lg font-semibold text-[#F1F5F9]">You're invited to join</div>
          <div className="text-2xl font-bold text-[#6366F1] mt-1">{familyName}</div>
        </div>

        <div className="bg-[#1E293B] rounded-2xl p-8 border border-[#334155] space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1.5">Email</label>
            <input value={invite.email} disabled className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#64748B]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1.5">Your Name</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1.5">Create Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]" onKeyDown={e => e.key === 'Enter' && handleJoin()} />
          </div>
          {error && <div className="text-red-400 text-sm bg-red-900/20 rounded-lg px-4 py-3">{error}</div>}
          <button onClick={handleJoin} disabled={submitting} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50">
            {submitting ? 'Joining...' : `Join ${familyName}`}
          </button>
        </div>
      </div>
    </div>
  )
}
