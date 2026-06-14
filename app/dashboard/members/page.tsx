'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function MembersPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [family, setFamily] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [invites, setInvites] = useState<any[]>([])
  const [tab, setTab] = useState<'members' | 'invite'>('members')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [isChild, setIsChild] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [emailSent, setEmailSent] = useState('')

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  const load = async () => {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return
    const { data: profile } = await supabase.from('users').select('*, family:families(*)').eq('id', sess.session.user.id).single()
    setUser(profile)
    setFamily(profile?.family)
    const [{ data: m }, { data: i }] = await Promise.all([
      supabase.from('users').select('*').order('is_child').order('display_name'),
      supabase.from('user_invites').select('*').order('created_at', { ascending: false }),
    ])
    setMembers(m ?? [])
    setInvites(i ?? [])
  }

  useEffect(() => { load() }, [])

  const handleInvite = async () => {
    if (!inviteEmail) return
    setSending(true)
    setInviteLink(''); setEmailSent('')
    try {
      const { data: u } = await supabase.auth.getUser()
      const fid = await getFamilyId()
      const code = Math.random().toString(36).substring(2, 10)
      await supabase.from('user_invites').insert({
        family_id: fid,
        invited_by: u.user!.id,
        email: inviteEmail,
        role: inviteRole,
        is_child: isChild,
        code,
      })

      // Send the invite email directly
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      const res = await fetch(`${supabaseUrl}/functions/v1/send-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({
          email: inviteEmail,
          code,
          familyName: family?.name ?? 'our family',
          origin: window.location.origin,
        }),
      })
      const result = await res.json()

      if (result.success) {
        setEmailSent(inviteEmail)
      } else {
        // Fall back to showing the link if email fails
        setInviteLink(`${window.location.origin}/join/${code}`)
      }
      setSent(true)
      setInviteEmail('')
      load()
    } catch (e) {
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  const cancelInvite = async (id: string) => {
    await supabase.from('user_invites').delete().eq('id', id)
    load()
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-[#F1F5F9] mb-6">Family Members</h1>

      <div className="flex bg-[#1E293B] rounded-xl p-1 mb-6 border border-[#334155]">
        <button onClick={() => setTab('members')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'members' ? 'bg-[#6366F1] text-white' : 'text-[#64748B]'}`}>Members</button>
        {isAdmin && <button onClick={() => setTab('invite')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'invite' ? 'bg-[#6366F1] text-white' : 'text-[#64748B]'}`}>Invite</button>}
      </div>

      {tab === 'members' && (
        <div className="space-y-3">
          {members.map(m => (
            <div key={m.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${m.is_child ? 'bg-[#7C3AED]' : 'bg-[#6366F1]'}`}>
                {m.display_name?.[0]}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[#F1F5F9]">{m.display_name}</div>
                <div className="text-sm text-[#64748B]">{m.email}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${m.role === 'admin' ? 'bg-[#312E81] text-[#A5B4FC]' : 'bg-[#1E293B] text-[#64748B] border border-[#334155]'}`}>
                  {m.role}
                </span>
                {m.is_child && <span className="text-xs text-[#7C3AED] font-semibold">child</span>}
                <span className="text-xs font-bold text-[#6366F1]">{m.points_balance} pts</span>
              </div>
            </div>
          ))}

          {invites.filter(i => !i.accepted_at).length > 0 && (
            <>
              <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide pt-4 pb-2">Pending Invites</div>
              {invites.filter(i => !i.accepted_at).map(i => (
                <div key={i.id} className="bg-[#1E293B]/60 border border-[#334155]/60 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#94A3B8]">{i.email}</div>
                    <div className="text-xs text-[#475569] mt-0.5">Invited · expires {new Date(i.expires_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#F59E0B] bg-[#78350F]/40 px-2 py-1 rounded-lg">Pending</span>
                    <button onClick={() => cancelInvite(i.id)} className="text-xs font-semibold text-red-400 hover:text-red-300 bg-red-900/20 px-2 py-1 rounded-lg">Remove</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'invite' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-6 space-y-4">
            <h2 className="font-bold text-[#F1F5F9]">Invite Someone</h2>

            <div>
              <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1.5">Email</label>
              <input
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="their@email.com"
                className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide block mb-2">Role</label>
              <div className="flex gap-2">
                <button onClick={() => { setInviteRole('member'); setIsChild(false) }} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${inviteRole === 'member' && !isChild ? 'bg-[#6366F1] text-white' : 'bg-[#0F172A] text-[#64748B] border border-[#334155]'}`}>Adult Member</button>
                <button onClick={() => { setInviteRole('admin'); setIsChild(false) }} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${inviteRole === 'admin' ? 'bg-[#6366F1] text-white' : 'bg-[#0F172A] text-[#64748B] border border-[#334155]'}`}>Admin</button>
                <button onClick={() => { setInviteRole('member'); setIsChild(true) }} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${isChild ? 'bg-[#7C3AED] text-white' : 'bg-[#0F172A] text-[#64748B] border border-[#334155]'}`}>Child</button>
              </div>
            </div>

            <button
              onClick={handleInvite}
              disabled={sending || !inviteEmail}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
            >
              {sending ? 'Generating...' : 'Generate Invite Link'}
            </button>
          </div>

          {sent && emailSent && (
            <div className="bg-[#1E3A2F] border border-[#10B981]/30 rounded-xl p-5">
              <div className="font-bold text-[#10B981] mb-2">✅ Invite sent!</div>
              <div className="text-sm text-[#94A3B8]">We emailed an invite to <span className="text-[#F1F5F9] font-semibold">{emailSent}</span>. They'll get a link to create their account and join {family?.name}. The invite expires in 7 days.</div>
            </div>
          )}

          {sent && inviteLink && (
            <div className="bg-[#1E3A2F] border border-[#10B981]/30 rounded-xl p-5">
              <div className="font-bold text-[#10B981] mb-2">✅ Invite link ready!</div>
              <div className="text-sm text-[#94A3B8] mb-3">We couldn't auto-send the email, so share this link with them directly — it expires in 7 days.</div>
              <div className="bg-[#0F172A] border border-[#334155] rounded-lg px-4 py-3 text-[#F1F5F9] text-sm font-mono break-all">{inviteLink}</div>
              <button
                onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="mt-3 w-full bg-[#10B981] text-white font-bold py-2.5 rounded-xl hover:bg-[#059669]"
              >
                Copy Link
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
