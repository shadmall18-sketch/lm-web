'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function MemoriesPage() {
  const supabase = createClient()
  const [memories, setMemories] = useState<any[]>([])
  const [taggable, setTaggable] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title:'', content:'', memory_date: new Date().toISOString().split('T')[0] })
  const [selectedTags, setSelectedTags] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [pendingTags, setPendingTags] = useState<any[]>([])

  const loadPending = async (userId: string) => {
    const { data } = await supabase.from('memory_tags')
      .select('*, memory:memories(title, content, memory_date, creator:users!created_by(display_name))')
      .eq('tagged_user_id', userId)
      .eq('status', 'pending')
    setPendingTags(data ?? [])
  }

  const respondTag = async (tagId: string, approve: boolean) => {
    await supabase.from('memory_tags').update({ status: approve ? 'approved' : 'declined' }).eq('id', tagId)
    if (me) loadPending(me.id)
    load()
  }

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  const load = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data: meData } = await supabase.from('users').select('id, family_id, role').eq('id', u.user!.id).single()
    setMe(meData)
    if (meData) loadPending(meData.id)

    // Memories visible to me (my family + ones I'm tagged in)
    const { data } = await supabase.from('memories')
      .select('*, creator:users!created_by(display_name), tags:memory_tags(*, user:users!tagged_user_id(display_name), managed:managed_persons!tagged_managed_id(display_name))')
      .order('memory_date', { ascending: false })
    setMemories(data ?? [])

    // Build taggable list: family members + managed persons + network members
    const { data: nets } = await supabase.from('family_networks')
      .select('family_id_a, family_id_b')
      .or(`family_id_a.eq.${meData?.family_id},family_id_b.eq.${meData?.family_id}`)
    const networkFamilyIds = (nets ?? []).map((n: any) =>
      n.family_id_a === meData?.family_id ? n.family_id_b : n.family_id_a)

    const { data: famMembers } = await supabase.from('users')
      .select('id, display_name, family_id').in('family_id', [meData?.family_id, ...networkFamilyIds])
    const { data: managed } = await supabase.from('managed_persons')
      .select('id, display_name, family_id').is('converted_user_id', null)

    const list = [
      ...(famMembers ?? []).map((m: any) => ({
        key: `user-${m.id}`, id: m.id, type: 'user', name: m.display_name,
        isNetwork: m.family_id !== meData?.family_id,
      })),
      ...(managed ?? []).map((m: any) => ({
        key: `managed-${m.id}`, id: m.id, type: 'managed', name: `${m.display_name} (child)`,
        isNetwork: m.family_id !== meData?.family_id,
      })),
    ]
    setTaggable(list)
  }

  useEffect(() => { load() }, [])

  const toggleTag = (t: any) => {
    setSelectedTags(prev => prev.find(x => x.key === t.key) ? prev.filter(x => x.key !== t.key) : [...prev, t])
  }

  const handleAdd = async () => {
    if (!form.title && !form.content) return
    const { data: u } = await supabase.auth.getUser()
    const fid = await getFamilyId()
    const { data: mem } = await supabase.from('memories').insert({ ...form, family_id: fid, created_by: u.user!.id }).select().single()

    // Insert tags
    if (mem && selectedTags.length > 0) {
      const tagRows = selectedTags.map(t => ({
        memory_id: mem.id,
        tagged_user_id: t.type === 'user' ? t.id : null,
        tagged_managed_id: t.type === 'managed' ? t.id : null,
        tagged_by: u.user!.id,
        // Network real-user tags need approval; family + managed are auto-approved
        status: (t.type === 'user' && t.isNetwork) ? 'pending' : 'approved',
      }))
      await supabase.from('memory_tags').insert(tagRows)
    }

    setShowAdd(false); setSelectedTags([]); setForm({ title:'', content:'', memory_date: new Date().toISOString().split('T')[0] }); load()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Memories</h1>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#4F46E5]">+ Add</button>
      </div>

      {/* Pending tag requests from network families */}
      {pendingTags.length > 0 && (
        <div className="bg-[#3A2A0F] border border-[#F59E0B]/40 rounded-xl p-4 mb-6">
          <div className="text-sm font-bold text-[#F59E0B] mb-3">🌐 You've been tagged in {pendingTags.length} memor{pendingTags.length===1?'y':'ies'} from another family</div>
          <div className="space-y-2">
            {pendingTags.map(pt => (
              <div key={pt.id} className="bg-[#1E293B] rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-[#F1F5F9] font-semibold">{pt.memory?.title || 'Untitled memory'}</div>
                  <div className="text-xs text-[#64748B]">by {pt.memory?.creator?.display_name}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => respondTag(pt.id, true)} className="bg-[#10B981] text-white text-xs font-bold px-3 py-1.5 rounded-lg">Accept</button>
                  <button onClick={() => respondTag(pt.id, false)} className="bg-[#1E293B] border border-red-500/40 text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg">Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-6 space-y-3">
          <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} placeholder="Title" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <textarea value={form.content} onChange={e => setForm(p=>({...p,content:e.target.value}))} placeholder="What happened? What do you want to remember?" rows={4} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1] resize-none" />
          <div>
            <label className="text-xs text-[#94A3B8] block mb-1">When did this happen? (can be in the past)</label>
            <input value={form.memory_date} onChange={e => setForm(p=>({...p,memory_date:e.target.value}))} type="date" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
          </div>

          {/* Tag people */}
          <div>
            <label className="text-xs text-[#94A3B8] block mb-2">Tag people in this memory</label>
            <div className="flex flex-wrap gap-2">
              {taggable.map(t => (
                <button key={t.key} onClick={() => toggleTag(t)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${selectedTags.find(x=>x.key===t.key) ? 'bg-[#6366F1] text-white border-[#6366F1]' : 'bg-[#0F172A] text-[#94A3B8] border-[#334155]'}`}>
                  {t.name}{t.isNetwork && ' 🌐'}
                </button>
              ))}
              {taggable.length === 0 && <span className="text-xs text-[#475569] italic">No one to tag yet</span>}
            </div>
            {selectedTags.some(t => t.isNetwork && t.type === 'user') && (
              <p className="text-xs text-[#F59E0B] mt-2">🌐 Network tags need that person to approve before it shows on their account.</p>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={handleAdd} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg">Save Memory</button>
            <button onClick={() => { setShowAdd(false); setSelectedTags([]) }} className="text-[#64748B] text-sm px-4 py-2 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {memories.map(m => {
          const approvedTags = (m.tags ?? []).filter((t: any) => t.status === 'approved')
          return (
            <div key={m.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-[#6366F1]">{m.memory_date ? new Date(m.memory_date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : ''}</span>
                <span className="text-xs text-[#64748B]">{m.creator?.display_name}</span>
              </div>
              {m.title && <h3 className="font-bold text-[#F1F5F9] mb-2">{m.title}</h3>}
              {m.content && <p className="text-sm text-[#94A3B8] leading-relaxed mb-3">{m.content}</p>}
              {approvedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#334155]">
                  {approvedTags.map((t: any) => (
                    <span key={t.id} className="text-xs bg-[#312E81] text-[#A5B4FC] px-2 py-0.5 rounded-full">
                      {t.user?.display_name ?? t.managed?.display_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {memories.length===0 && <div className="col-span-2 text-center text-[#475569] italic py-16">No memories yet — capture your first family moment!</div>}
      </div>
    </div>
  )
}
