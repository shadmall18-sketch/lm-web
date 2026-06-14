'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function GroceryPage() {
  const supabase = createClient()
  const [items, setItems] = useState<any[]>([])
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  const load = async () => {
    const { data } = await supabase.from('grocery_list').select('*, added_by_user:users!added_by(display_name)').order('is_checked').order('created_at')
    setItems(data ?? [])
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!name.trim()) return
    const { data: u } = await supabase.auth.getUser()
    const fid = await getFamilyId()
    await supabase.from('grocery_list').insert({ name: name.trim(), quantity: parseInt(qty)||1, family_id: fid, added_by: u.user!.id })
    setName(''); setQty('1'); load()
  }

  const handleCheck = async (id: string, checked: boolean) => {
    const { data: u } = await supabase.auth.getUser()
    await supabase.from('grocery_list').update({ is_checked: !checked, checked_by: u.user!.id }).eq('id', id)
    load()
  }

  const handleClear = async () => {
    await supabase.from('grocery_list').delete().eq('is_checked', true)
    load()
  }

  const unchecked = items.filter(i => !i.is_checked)
  const checked = items.filter(i => i.is_checked)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Grocery List</h1>
        {checked.length > 0 && <button onClick={handleClear} className="text-sm text-[#64748B] hover:text-[#F1F5F9]">Clear checked</button>}
      </div>

      <div className="flex gap-2 mb-6">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key==='Enter' && handleAdd()} placeholder="Add item..." className="flex-1 bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]" />
        <input value={qty} onChange={e => setQty(e.target.value)} type="number" className="w-16 bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-3 text-[#F1F5F9] text-center focus:outline-none focus:border-[#6366F1]" />
        <button onClick={handleAdd} className="bg-[#6366F1] text-white font-bold px-5 rounded-xl hover:bg-[#4F46E5]">Add</button>
      </div>

      <div className="space-y-2">
        {unchecked.map(item => (
          <button key={item.id} onClick={() => handleCheck(item.id, false)} className="w-full bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center gap-3 hover:border-[#6366F1] transition-all text-left">
            <div className="w-5 h-5 rounded-full border-2 border-[#6366F1] flex-shrink-0" />
            <span className="flex-1 font-semibold text-[#F1F5F9]">{item.name}</span>
            {item.quantity > 1 && <span className="text-sm font-bold text-[#6366F1]">x{item.quantity}</span>}
            {item.added_by_user && <span className="text-xs text-[#475569]">{item.added_by_user.display_name}</span>}
          </button>
        ))}

        {checked.length > 0 && (
          <>
            <div className="text-xs font-bold text-[#475569] uppercase tracking-wide pt-4 pb-2">Checked ({checked.length})</div>
            {checked.map(item => (
              <button key={item.id} onClick={() => handleCheck(item.id, true)} className="w-full bg-[#1E293B]/40 border border-[#334155]/40 rounded-xl p-4 flex items-center gap-3 text-left opacity-50 hover:opacity-70">
                <div className="w-5 h-5 rounded-full bg-[#6366F1] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs">✓</span>
                </div>
                <span className="flex-1 text-[#64748B] line-through">{item.name}</span>
              </button>
            ))}
          </>
        )}
        {items.length === 0 && <div className="text-center text-[#475569] italic py-12">List is empty — add something above</div>}
      </div>
    </div>
  )
}
