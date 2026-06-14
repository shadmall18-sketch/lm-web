'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function ContactsPage() {
  const supabase = createClient()
  const [contacts, setContacts] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [gifts, setGifts] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ first_name:'', last_name:'', relationship:'', date_of_birth:'', phone:'', email:'', notes:'' })

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  const load = async () => {
    const { data } = await supabase.from('contacts').select('*, preferences:contact_preferences(*)').order('first_name')

    // Pull in family + network members as auto-contacts with About Me info
    const { data: u } = await supabase.auth.getUser()
    const { data: me } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()

    // Find connected network family ids
    const { data: nets } = await supabase.from('family_networks')
      .select('family_id_a, family_id_b')
      .or(`family_id_a.eq.${me?.family_id},family_id_b.eq.${me?.family_id}`)
    const networkFamilyIds = (nets ?? []).map((n: any) =>
      n.family_id_a === me?.family_id ? n.family_id_b : n.family_id_a
    )
    const allFamilyIds = [me?.family_id, ...networkFamilyIds]

    // Get all members of those families + their about_me
    const { data: members } = await supabase.from('users')
      .select('id, display_name, family_id, is_child, family:families(name)')
      .in('family_id', allFamilyIds)
      .neq('id', u.user!.id)

    const { data: abouts } = await supabase.from('about_me').select('*')
    const aboutMap = new Map((abouts ?? []).map((a: any) => [a.user_id, a]))

    const memberContacts = (members ?? []).map((m: any) => {
      const about = aboutMap.get(m.id)
      return {
        id: `member-${m.id}`,
        first_name: m.display_name?.split(' ')[0] ?? m.display_name,
        last_name: m.display_name?.split(' ').slice(1).join(' ') ?? '',
        relationship: m.family_id === me?.family_id ? 'Family' : `${(m.family as any)?.name ?? 'Network'} Family`,
        is_family_member: m.family_id === me?.family_id,
        isMember: true,
        about,
        preferences: about ? [
          about.favorite_color && { id: 'c', label: 'Favorite Color', value: about.favorite_color },
          about.favorite_snacks && { id: 's', label: 'Favorite Snacks', value: about.favorite_snacks },
          about.favorite_foods && { id: 'f', label: 'Favorite Foods', value: about.favorite_foods },
          about.favorite_activities && { id: 'a', label: 'Favorite Activities', value: about.favorite_activities },
          about.favorite_with_others && { id: 'w', label: 'Loves Doing Together', value: about.favorite_with_others },
          about.hobbies && { id: 'h', label: 'Hobbies', value: about.hobbies },
          about.clothing_size && { id: 'cl', label: 'Clothing Size', value: about.clothing_size },
          about.shoe_size && { id: 'sh', label: 'Shoe Size', value: about.shoe_size },
          about.allergies && { id: 'al', label: 'Allergies', value: about.allergies },
        ].filter(Boolean) : [],
      }
    })

    setContacts([...memberContacts, ...(data ?? [])])
  }

  useEffect(() => { load() }, [])

  const handleSelect = async (c: any) => {
    setSelected(c)
    if (c.isMember) { setGifts([]); return }
    const { data } = await supabase.from('gifts').select('*').eq('contact_id', c.id).order('created_at', { ascending: false })
    setGifts(data ?? [])
  }

  const handleAdd = async () => {
    if (!form.first_name) return
    const fid = await getFamilyId()
    await supabase.from('contacts').insert({ ...form, family_id: fid, date_of_birth: form.date_of_birth || null })
    setShowAdd(false); setForm({ first_name:'', last_name:'', relationship:'', date_of_birth:'', phone:'', email:'', notes:'' }); load()
  }

  if (selected) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => setSelected(null)} className="text-[#6366F1] mb-6 hover:underline">← Back</button>
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full bg-[#6366F1] flex items-center justify-center text-white font-black text-3xl mb-3">{selected.first_name[0]}{selected.last_name?.[0]??''}</div>
        <h1 className="text-2xl font-bold text-[#F1F5F9]">{selected.first_name} {selected.last_name}</h1>
        {selected.relationship && <p className="text-[#64748B] mt-1">{selected.relationship}</p>}
      </div>
      <div className="space-y-2 mb-6">
        {selected.date_of_birth && <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex justify-between"><span className="text-[#64748B]">🎂 Birthday</span><span className="text-[#F1F5F9] font-semibold">{new Date(selected.date_of_birth).toLocaleDateString()}</span></div>}
        {selected.phone && <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex justify-between"><span className="text-[#64748B]">📞 Phone</span><span className="text-[#F1F5F9] font-semibold">{selected.phone}</span></div>}
        {selected.email && <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex justify-between"><span className="text-[#64748B]">✉️ Email</span><span className="text-[#F1F5F9] font-semibold">{selected.email}</span></div>}
        {selected.notes && <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4"><span className="text-[#64748B] block mb-1">📝 Notes</span><span className="text-[#F1F5F9]">{selected.notes}</span></div>}
      </div>
      {selected.preferences?.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wide mb-3">Preferences</h2>
          <div className="space-y-2">{selected.preferences.map((p: any) => <div key={p.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-3 flex justify-between"><span className="text-[#94A3B8]">{p.label}</span><span className="text-[#F1F5F9] font-semibold">{p.value}</span></div>)}</div>
        </div>
      )}
      <div>
        <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wide mb-3">Gift Ideas</h2>
        {gifts.length === 0 ? <div className="text-[#475569] italic text-sm">No gift ideas yet</div> : gifts.map(g => <div key={g.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-3 flex justify-between mb-2"><span className="text-[#F1F5F9]">{g.title}</span><span className={`text-xs font-semibold capitalize ${g.status==='purchased'?'text-green-400':'text-[#64748B]'}`}>{g.status}</span></div>)}
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">People</h1>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#4F46E5]">+ Add</button>
      </div>

      {showAdd && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.first_name} onChange={e => setForm(p=>({...p,first_name:e.target.value}))} placeholder="First name *" className="bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
            <input value={form.last_name} onChange={e => setForm(p=>({...p,last_name:e.target.value}))} placeholder="Last name" className="bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          </div>
          <input value={form.relationship} onChange={e => setForm(p=>({...p,relationship:e.target.value}))} placeholder="Relationship (Grandma, Coach...)" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <input value={form.phone} onChange={e => setForm(p=>({...p,phone:e.target.value}))} placeholder="Phone" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <input value={form.date_of_birth} onChange={e => setForm(p=>({...p,date_of_birth:e.target.value}))} type="date" placeholder="Birthday" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
          <textarea value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))} placeholder="Notes" rows={2} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1] resize-none" />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg">Save</button>
            <button onClick={() => setShowAdd(false)} className="text-[#64748B] text-sm px-4 py-2 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {contacts.filter(c=>c.is_family_member).length > 0 && <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Family</div>}
      <div className="space-y-2 mb-4">
        {contacts.filter(c=>c.is_family_member).map(c => <ContactRow key={c.id} contact={c} onClick={() => handleSelect(c)} />)}
      </div>
      {contacts.filter(c=>!c.is_family_member).length > 0 && <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2 mt-4">Friends & Others</div>}
      <div className="space-y-2">
        {contacts.filter(c=>!c.is_family_member).map(c => <ContactRow key={c.id} contact={c} onClick={() => handleSelect(c)} />)}
      </div>
      {contacts.length === 0 && <div className="text-center text-[#475569] italic py-12">No contacts yet</div>}
    </div>
  )
}

function ContactRow({ contact, onClick }: any) {
  return (
    <button onClick={onClick} className="w-full bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center gap-3 hover:border-[#6366F1] transition-all text-left">
      <div className="w-10 h-10 rounded-full bg-[#6366F1] flex items-center justify-center text-white font-bold">{contact.first_name[0]}{contact.last_name?.[0]??''}</div>
      <div className="flex-1">
        <div className="font-semibold text-[#F1F5F9]">{contact.first_name} {contact.last_name}</div>
        {contact.relationship && <div className="text-sm text-[#64748B]">{contact.relationship}</div>}
      </div>
      <span className="text-[#475569]">›</span>
    </button>
  )
}
