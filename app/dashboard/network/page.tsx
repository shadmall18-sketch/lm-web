'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function NetworkPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [familyId, setFamilyId] = useState<string>('')
  const [familyName, setFamilyName] = useState<string>('')
  const [networks, setNetworks] = useState<any[]>([])
  const [selectedNetwork, setSelectedNetwork] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const [tab, setTab] = useState<'chat' | 'connect'>('chat')
  const [inviteCode, setInviteCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return
    const uid = sess.session.user.id
    const { data: profile } = await supabase.from('users').select('*, family:families(*)').eq('id', uid).single()
    setUser(profile)
    setFamilyId(profile?.family_id)
    setFamilyName(profile?.family?.name)

    const { data: nets } = await supabase
      .from('family_networks')
      .select('*, family_a:families!family_id_a(name), family_b:families!family_id_b(name)')
      .or(`family_id_a.eq.${profile?.family_id},family_id_b.eq.${profile?.family_id}`)
    setNetworks(nets ?? [])
    if (nets && nets.length > 0 && !selectedNetwork) setSelectedNetwork(nets[0])
  }

  const loadMessages = async (networkId: string) => {
    const { data } = await supabase
      .from('network_messages')
      .select('*, sender:users!sent_by(display_name), family:families!family_id(name)')
      .eq('network_id', networkId)
      .order('created_at')
      .limit(50)
    setMessages(data ?? [])
    setTimeout(() => bottomRef.current?.scrollIntoView(), 100)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (selectedNetwork) loadMessages(selectedNetwork.id)
  }, [selectedNetwork])

  useEffect(() => {
    if (!selectedNetwork) return
    const channel = supabase.channel(`network:${selectedNetwork.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'network_messages', filter: `network_id=eq.${selectedNetwork.id}` }, () => loadMessages(selectedNetwork.id))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedNetwork?.id])

  const getOtherFamilyName = (network: any) => {
    if (network.family_id_a === familyId) return network.family_b?.name
    return network.family_a?.name
  }

  const handleSend = async () => {
    if (!text.trim() || !selectedNetwork) return
    const content = text.trim(); setText('')
    const { data: u } = await supabase.auth.getUser()
    await supabase.from('network_messages').insert({
      network_id: selectedNetwork.id,
      sent_by: u.user!.id,
      family_id: familyId,
      content,
    })
  }

  const handleGenerateInvite = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.rpc('generate_family_invite', {
      p_family_id: familyId,
      p_user_id: u.user!.id,
    })
    setGeneratedCode(data)
    setGeneratedLink(`${window.location.origin}/connect/${data}`)
  }

  const handleJoin = async () => {
    if (!inviteCode.trim()) return
    setJoining(true); setJoinError('')
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.rpc('accept_family_invite', {
      p_code: inviteCode.trim(),
      p_accepting_family_id: familyId,
      p_accepting_user_id: u.user!.id,
    })
    if (data) {
      setJoinSuccess(true); setInviteCode(''); load()
    } else {
      setJoinError('Invalid or expired invite code.')
    }
    setJoining(false)
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[#F1F5F9] mb-2">Family Network</h1>
      <p className="text-[#64748B] text-sm mb-6">Chat with connected families — grandparents, cousins, extended family.</p>

      <div className="flex bg-[#1E293B] rounded-xl p-1 mb-6 border border-[#334155]">
        <button onClick={() => setTab('chat')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'chat' ? 'bg-[#6366F1] text-white' : 'text-[#64748B]'}`}>Network Chat</button>
        {isAdmin && <button onClick={() => setTab('connect')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'connect' ? 'bg-[#6366F1] text-white' : 'text-[#64748B]'}`}>Connect Families</button>}
      </div>

      {tab === 'chat' && (
        <div>
          {networks.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">👨‍👩‍👧‍👦</div>
              <div className="text-[#F1F5F9] font-bold text-lg mb-2">No connected families yet</div>
              <div className="text-[#64748B] text-sm mb-6">Connect with extended family to start chatting together.</div>
              {isAdmin && <button onClick={() => setTab('connect')} className="bg-[#6366F1] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#4F46E5]">Connect a Family</button>}
            </div>
          ) : (
            <div className="flex gap-4 h-[60vh]">
              {/* Network list */}
              {networks.length > 1 && (
                <div className="w-48 flex-shrink-0 space-y-2">
                  {networks.map(n => (
                    <button key={n.id} onClick={() => setSelectedNetwork(n)}
                      className={`w-full text-left p-3 rounded-xl text-sm font-semibold transition-all ${selectedNetwork?.id === n.id ? 'bg-[#6366F1] text-white' : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155] hover:border-[#6366F1]'}`}>
                      {getOtherFamilyName(n)}
                    </button>
                  ))}
                </div>
              )}

              {/* Chat area */}
              <div className="flex-1 flex flex-col bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#334155]">
                  <div className="font-bold text-[#F1F5F9]">{selectedNetwork ? getOtherFamilyName(selectedNetwork) : ''} Family</div>
                  <div className="text-xs text-[#64748B]">{familyName} ↔ {selectedNetwork ? getOtherFamilyName(selectedNetwork) : ''}</div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map(msg => {
                    const isMe = msg.sent_by === user?.id
                    const isMyFamily = msg.family_id === familyId
                    return (
                      <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${isMyFamily ? 'bg-[#6366F1]' : 'bg-[#7C3AED]'}`}>
                          {msg.sender?.display_name?.[0]}
                        </div>
                        <div className={`max-w-xs rounded-2xl px-4 py-2.5 ${isMe ? 'bg-[#6366F1] rounded-br-sm' : 'bg-[#0F172A] rounded-bl-sm border border-[#334155]'}`}>
                          {!isMe && (
                            <div className="text-xs font-bold mb-1" style={{ color: isMyFamily ? '#818CF8' : '#A78BFA' }}>
                              {msg.sender?.display_name} · {msg.family?.name}
                            </div>
                          )}
                          <div className="text-[#F1F5F9] text-sm">{msg.content}</div>
                          <div className="text-xs text-[#64748B] mt-1 text-right">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>

                <div className="p-3 border-t border-[#334155] flex gap-2">
                  <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Message extended family..." className="flex-1 bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-2.5 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
                  <button onClick={handleSend} className="w-10 h-10 rounded-full bg-[#6366F1] flex items-center justify-center text-white font-bold hover:bg-[#4F46E5]">↑</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'connect' && isAdmin && (
        <div className="space-y-6 max-w-lg">
          {/* Generate invite */}
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-6">
            <h2 className="font-bold text-[#F1F5F9] mb-1">Invite a Family</h2>
            <p className="text-sm text-[#64748B] mb-4">Generate a link and send it to another family's admin.</p>
            <button onClick={handleGenerateInvite} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3 rounded-xl transition-all">
              Generate Invite Link
            </button>
            {generatedLink && (
              <div className="mt-4 space-y-2">
                <div className="bg-[#0F172A] border border-[#334155] rounded-lg px-4 py-3 text-[#F1F5F9] text-sm font-mono break-all">{generatedLink}</div>
                <button onClick={() => navigator.clipboard.writeText(generatedLink)} className="w-full bg-[#10B981] text-white font-bold py-2.5 rounded-xl hover:bg-[#059669]">
                  Copy Link
                </button>
                <p className="text-xs text-[#64748B] text-center">Expires in 7 days</p>
              </div>
            )}
          </div>

          {/* Join via code */}
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-6">
            <h2 className="font-bold text-[#F1F5F9] mb-1">Join a Family Network</h2>
            <p className="text-sm text-[#64748B] mb-4">Enter the invite code another family sent you.</p>
            <input value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Enter invite code" className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#6366F1] mb-3 font-mono" />
            {joinError && <div className="text-red-400 text-sm mb-3">{joinError}</div>}
            {joinSuccess && <div className="text-green-400 text-sm mb-3">✅ Connected! Go to Network Chat to start messaging.</div>}
            <button onClick={handleJoin} disabled={joining || !inviteCode} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50">
              {joining ? 'Connecting...' : 'Connect Family'}
            </button>
          </div>

          {/* Connected families */}
          {networks.length > 0 && (
            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-6">
              <h2 className="font-bold text-[#F1F5F9] mb-4">Connected Families</h2>
              <div className="space-y-2">
                {networks.map(n => (
                  <div key={n.id} className="flex items-center gap-3 p-3 bg-[#0F172A] rounded-xl border border-[#334155]">
                    <div className="w-9 h-9 rounded-full bg-[#7C3AED] flex items-center justify-center text-white font-bold">{getOtherFamilyName(n)?.[0]}</div>
                    <div>
                      <div className="font-semibold text-[#F1F5F9]">{getOtherFamilyName(n)} Family</div>
                      <div className="text-xs text-[#64748B]">Connected {new Date(n.connected_at).toLocaleDateString()}</div>
                    </div>
                    <span className="ml-auto text-xs font-bold text-[#10B981] bg-[#1E3A2F] px-2 py-1 rounded-lg">Connected</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
