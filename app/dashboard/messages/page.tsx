'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { subscribeToPush, getPushStatus } from '@/lib/push'

export default function MessagesPage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [family, setFamily] = useState<any>(null)
  const [text, setText] = useState('')
  const [type, setType] = useState<'chat'|'announcement'|'emergency'>('chat')
  const [pushStatus, setPushStatus] = useState<string>('default')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { getPushStatus().then(setPushStatus) }, [])

  const enablePush = async () => {
    try {
      await subscribeToPush()
      setPushStatus('granted')
    } catch (e: any) {
      alert(e.message === 'Push not supported on this device'
        ? 'To get notifications on iPhone, first add this app to your home screen (Share → Add to Home Screen), then open it from there and try again.'
        : 'Could not enable notifications: ' + e.message)
    }
  }

  const load = async () => {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return
    const { data: profile } = await supabase.from('users').select('*, family:families(*)').eq('id', sess.session.user.id).single()
    setUser(profile); setFamily(profile?.family)

    if (!profile?.family_id) return

    // Load messages explicitly filtered by family
    const { data: msgs, error } = await supabase
      .from('messages')
      .select('*, sender:users!messages_sent_by_fkey(display_name)')
      .eq('family_id', profile.family_id)
      .order('created_at')
      .limit(50)

    if (error) {
      // Fallback: load without the join if the relationship lookup fails
      const { data: plain } = await supabase
        .from('messages')
        .select('*')
        .eq('family_id', profile.family_id)
        .order('created_at')
        .limit(50)
      // Attach sender names manually
      const { data: members } = await supabase.from('users').select('id, display_name').eq('family_id', profile.family_id)
      const nameMap = new Map((members ?? []).map((m: any) => [m.id, m.display_name]))
      setMessages((plain ?? []).map((m: any) => ({ ...m, sender: { display_name: nameMap.get(m.sent_by) } })))
    } else {
      setMessages(msgs ?? [])
    }
    setTimeout(() => bottomRef.current?.scrollIntoView(), 100)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!family?.id) return
    const channel = supabase.channel(`msgs:${family.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `family_id=eq.${family.id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [family?.id])

  const handleSend = async () => {
    if (!text.trim()) return
    const content = text.trim(); setText('')
    const { data: u } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('family_id, display_name').eq('id', u.user!.id).single()
    await supabase.from('messages').insert({ family_id: profile?.family_id, sent_by: u.user!.id, type, content })

    // Fire push notification to the rest of the family
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({
        familyId: profile?.family_id,
        senderId: u.user!.id,
        senderName: profile?.display_name ?? 'Family',
        content, type,
      }),
    }).catch(() => {})
  }

  const typeColor = (t: string) => t==='emergency'?'#EF4444':t==='announcement'?'#F59E0B':'#6366F1'

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Family Chat</h1>
        <div className="flex gap-2 items-center">
          {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
            <button onClick={enablePush} title="Enable notifications" className="text-xs font-semibold text-[#6366F1] bg-[#1E1B4B] px-3 py-1.5 rounded-full hover:bg-[#312E81]">
              🔔 Notify me
            </button>
          )}
          {(['chat','announcement','emergency'] as const).map(t => (
            <button key={t} onClick={() => setType(t)} className="w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all" style={{backgroundColor: type===t ? typeColor(t) : '#1E293B'}}>
              {t==='chat'?'💬':t==='announcement'?'📢':'🚨'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.map(msg => {
          const isMe = msg.sent_by === user?.id
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe?'flex-row-reverse':''}`}>
              {!isMe && <div className="w-7 h-7 rounded-full bg-[#6366F1] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{msg.sender?.display_name?.[0]}</div>}
              <div className={`max-w-xs md:max-w-md rounded-2xl px-4 py-2.5 ${isMe?'bg-[#6366F1] rounded-br-sm':'bg-[#1E293B] rounded-bl-sm border border-[#334155]'} ${msg.type==='emergency'?'bg-red-900 border border-red-500':''} ${msg.type==='announcement'?'bg-amber-900 border border-amber-500':''}`}>
                {!isMe && <div className="text-xs font-bold text-[#6366F1] mb-1">{msg.sender?.display_name}</div>}
                {msg.type!=='chat' && <div className="text-xs font-bold text-red-300 mb-1">{msg.type==='emergency'?'🚨 EMERGENCY':'📢 ANNOUNCEMENT'}</div>}
                <div className="text-[#F1F5F9] text-sm">{msg.content}</div>
                <div className="text-xs text-[#64748B] mt-1 text-right">{new Date(msg.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSend()} placeholder="Message family..." className="flex-1 bg-[#1E293B] border border-[#334155] rounded-2xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
        <button onClick={handleSend} className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{backgroundColor: typeColor(type)}}>↑</button>
      </div>
    </div>
  )
}
