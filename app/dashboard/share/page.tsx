'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function ShareInner() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()

  const [me, setMe] = useState<any>(null)
  const [lists, setLists] = useState<any[]>([])
  const [content, setContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [dest, setDest] = useState<'chat'|'list'|null>(null)
  const [chosenList, setChosenList] = useState<string>('')
  const [itemTitle, setItemTitle] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState('')

  useEffect(() => {
    // Pull shared data from URL (Android share target) or leave blank for manual paste
    const title = params.get('title') ?? ''
    const text = params.get('text') ?? ''
    const url = params.get('url') ?? ''
    // Some apps put the URL inside text
    const foundUrl = url || (text.match(/https?:\/\/[^\s]+/)?.[0] ?? '')
    setLinkUrl(foundUrl)
    setContent([title, text].filter(Boolean).join(' ').trim())
    setItemTitle(title || text.replace(foundUrl, '').trim() || 'Shared item')

    const init = async () => {
      const { data: u } = await supabase.auth.getUser()
      if (!u.user) { router.push('/'); return }
      const { data: meData } = await supabase.from('users').select('id, family_id, display_name').eq('id', u.user.id).single()
      setMe(meData)
      const { data: myLists } = await supabase.from('wishlists').select('*').eq('owner_id', u.user.id).order('created_at', { ascending: false })
      setLists(myLists ?? [])
    }
    init()
  }, [])

  const getFamilyId = async () => {
    const { data } = await supabase.from('users').select('family_id').eq('id', me.id).single()
    return data?.family_id
  }

  const sendToChat = async () => {
    setSending(true)
    const fid = await getFamilyId()
    const link = linkUrl || (content.match(/https?:\/\/[^\s]+/)?.[0] ?? null)
    await supabase.from('messages').insert({
      family_id: fid, sent_by: me.id, type: 'chat',
      content: content || linkUrl, link_url: link,
    })
    setDone('chat')
    setTimeout(() => router.push('/dashboard/messages'), 800)
  }

  const sendToList = async () => {
    if (!chosenList) return
    setSending(true)
    await supabase.from('wishlist_items').insert({
      wishlist_id: chosenList,
      title: itemTitle || 'Shared item',
      link: linkUrl || null,
    })
    setDone('list')
    setTimeout(() => router.push('/dashboard/lists'), 800)
  }

  if (done) return (
    <div className="p-6 max-w-md mx-auto text-center pt-20">
      <div className="text-5xl mb-3">✅</div>
      <div className="text-lg font-bold text-[#F1F5F9]">Added to {done === 'chat' ? 'family chat' : 'your list'}!</div>
      <div className="text-sm text-[#64748B] mt-1">Taking you there...</div>
    </div>
  )

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-[#F1F5F9] mb-1">Share to LM</h1>
      <p className="text-[#64748B] text-sm mb-6">Where should this go?</p>

      {/* Manual paste / edit area */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-6 space-y-3">
        <div>
          <label className="text-xs text-[#94A3B8] block mb-1">Link</label>
          <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="Paste a link here" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
        </div>
        <div>
          <label className="text-xs text-[#94A3B8] block mb-1">Note / title</label>
          <input value={itemTitle} onChange={e => { setItemTitle(e.target.value); setContent(e.target.value) }} placeholder="Optional note" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
        </div>
      </div>

      {/* Destination picker */}
      <div className="space-y-3">
        <button onClick={() => setDest('chat')} className={`w-full text-left rounded-xl p-4 border ${dest==='chat'?'bg-[#1E1B4B] border-[#6366F1]':'bg-[#1E293B] border-[#334155]'}`}>
          <div className="font-semibold text-[#F1F5F9]">💬 Family Chat</div>
          <div className="text-xs text-[#64748B]">Share this with your whole family</div>
        </button>

        <button onClick={() => setDest('list')} className={`w-full text-left rounded-xl p-4 border ${dest==='list'?'bg-[#1E1B4B] border-[#6366F1]':'bg-[#1E293B] border-[#334155]'}`}>
          <div className="font-semibold text-[#F1F5F9]">🎁 A List</div>
          <div className="text-xs text-[#64748B]">Add to a wish, birthday, or Christmas list</div>
        </button>

        {dest === 'list' && (
          <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-3">
            {lists.length === 0 ? (
              <div className="text-sm text-[#64748B] italic">You don't have any lists yet. Create one on the Lists page first.</div>
            ) : (
              <select value={chosenList} onChange={e => setChosenList(e.target.value)} className="w-full bg-[#1E293B] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]">
                <option value="">Choose a list...</option>
                {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
          </div>
        )}

        <button
          onClick={dest === 'chat' ? sendToChat : sendToList}
          disabled={!dest || sending || (dest==='list' && !chosenList)}
          className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-40 mt-2"
        >
          {sending ? 'Adding...' : dest === 'list' ? 'Add to List' : 'Send to Chat'}
        </button>
      </div>
    </div>
  )
}

export default function SharePage() {
  return (
    <Suspense fallback={<div className="p-6 text-[#64748B]">Loading...</div>}>
      <ShareInner />
    </Suspense>
  )
}
