'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function MemoriesPage() {
  const supabase = createClient()
  const [memories, setMemories] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title:'', content:'', memory_date: new Date().toISOString().split('T')[0] })

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  const load = async () => {
    const { data } = await supabase.from('memories').select('*, creator:users!created_by(display_name)').order('memory_date', { ascending: false })
    setMemories(data ?? [])
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.title && !form.content) return
    const { data: u } = await supabase.auth.getUser()
    const fid = await getFamilyId()
    await supabase.from('memories').insert({ ...form, family_id: fid, created_by: u.user!.id })
    setShowAdd(false); setForm({ title:'', content:'', memory_date: new Date().toISOString().split('T')[0] }); load()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Memories</h1>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#4F46E5]">+ Add</button>
      </div>

      {showAdd && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-6 space-y-3">
          <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} placeholder="Title" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <textarea value={form.content} onChange={e => setForm(p=>({...p,content:e.target.value}))} placeholder="What happened? What do you want to remember?" rows={4} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1] resize-none" />
          <input value={form.memory_date} onChange={e => setForm(p=>({...p,memory_date:e.target.value}))} type="date" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg">Save Memory</button>
            <button onClick={() => setShowAdd(false)} className="text-[#64748B] text-sm px-4 py-2 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {memories.map(m => (
          <div key={m.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold text-[#6366F1]">{m.memory_date ? new Date(m.memory_date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : ''}</span>
              <span className="text-xs text-[#64748B]">{m.creator?.display_name}</span>
            </div>
            {m.title && <h3 className="font-bold text-[#F1F5F9] mb-2">{m.title}</h3>}
            {m.content && <p className="text-sm text-[#94A3B8] leading-relaxed">{m.content}</p>}
          </div>
        ))}
        {memories.length===0 && <div className="col-span-2 text-center text-[#475569] italic py-16">No memories yet — capture your first family moment!</div>}
      </div>
    </div>
  )
}
