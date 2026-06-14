'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ConnectPage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [invite, setInvite] = useState<any>(null)
  const [inviterFamily, setInviterFamily] = useState('')
  const [myFamily, setMyFamily] = useState('')
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const check = async () => {
      const { data: sess } = await supabase.auth.getSession()
      setSession(sess.session)

      const { data: inv } = await supabase
        .from('family_invites')
        .select('*, family:families(name)')
        .eq('code', code)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (inv) {
        setInvite(inv)
        setInviterFamily(inv.family?.name ?? 'A family')
      }

      if (sess.session) {
        const { data: profile } = await supabase.from('users').select('family:families(name)').eq('id', sess.session.user.id).single()
        setMyFamily((profile?.family as any)?.name ?? '')
      }
      setLoading(false)
    }
    check()
  }, [code])

  const handleConnect = async () => {
    setConnecting(true); setError('')
    const { data: u } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()

    const { data, error: rpcError } = await supabase.rpc('accept_family_invite', {
      p_code: code,
      p_accepting_family_id: profile!.family_id,
      p_accepting_user_id: u.user!.id,
    })

    if (rpcError || !data) {
      setError('Could not connect. The invite may have expired or you may be trying to connect your own family.')
      setConnecting(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/dashboard/network'), 2000)
    }
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
          <p className="text-[#64748B] text-sm mb-6">This connection link has expired or already been used.</p>
          <button onClick={() => router.push('/dashboard')} className="bg-[#6366F1] text-white font-bold px-6 py-3 rounded-xl">Go to Dashboard</button>
        </div>
      </div>
    </div>
  )

  // Not logged in — need to sign in first
  if (!session) return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="text-5xl font-black text-[#6366F1] mb-2">LM</div>
        <div className="text-lg font-semibold text-[#F1F5F9] mb-6"><span className="text-[#6366F1]">{inviterFamily}</span> wants to connect with your family</div>
        <div className="bg-[#1E293B] rounded-2xl p-8 border border-[#334155]">
          <p className="text-[#64748B] text-sm mb-6">Sign in to your family account to accept this connection. After signing in, click the link again.</p>
          <button onClick={() => router.push('/')} className="bg-[#6366F1] text-white font-bold px-6 py-3 rounded-xl w-full">Sign In First</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl font-black text-[#6366F1] mb-4">LM</div>
          <div className="flex items-center justify-center gap-3 text-[#F1F5F9]">
            <span className="font-bold">{myFamily}</span>
            <span className="text-[#6366F1] text-2xl">↔</span>
            <span className="font-bold">{inviterFamily}</span>
          </div>
        </div>

        <div className="bg-[#1E293B] rounded-2xl p-8 border border-[#334155] text-center">
          {success ? (
            <div className="text-green-400 py-4">
              <div className="text-3xl mb-2">✅</div>
              <div className="font-bold">Connected! Taking you to chat...</div>
            </div>
          ) : (
            <>
              <div className="text-5xl mb-4">👨‍👩‍👧‍👦</div>
              <h2 className="text-xl font-bold text-[#F1F5F9] mb-2">Connect families?</h2>
              <p className="text-[#64748B] text-sm mb-6">This will let <span className="text-[#F1F5F9]">{myFamily}</span> and <span className="text-[#F1F5F9]">{inviterFamily}</span> chat together in the Family Network.</p>
              {error && <div className="text-red-400 text-sm bg-red-900/20 rounded-lg px-4 py-3 mb-4">{error}</div>}
              <button onClick={handleConnect} disabled={connecting} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50">
                {connecting ? 'Connecting...' : 'Accept & Connect'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
