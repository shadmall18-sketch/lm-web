'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const ABOUT_FIELDS = [
  { key: 'favorite_color', label: 'Favorite Color' },
  { key: 'favorite_snacks', label: 'Favorite Snacks' },
  { key: 'favorite_foods', label: 'Favorite Foods' },
  { key: 'favorite_activities', label: 'Favorite Activities' },
  { key: 'favorite_with_others', label: 'Loves Doing Together' },
  { key: 'hobbies', label: 'Hobbies' },
  { key: 'clothing_size', label: 'Clothing Size' },
  { key: 'shoe_size', label: 'Shoe Size' },
  { key: 'allergies', label: 'Allergies' },
]

const BLANK = {
  first_name:'', last_name:'', relationship:'', date_of_birth:'', phone:'', email:'', address:'', notes:'',
  favorite_color:'', favorite_snacks:'', favorite_foods:'', favorite_activities:'',
  favorite_with_others:'', hobbies:'', clothing_size:'', shoe_size:'', allergies:'',
  is_private: false,
}

export default function ContactsPage() {
  const supabase = createClient()
  const [contacts, setContacts] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [gifts, setGifts] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [newNote, setNewNote] = useState('')
  const [notePrivate, setNotePrivate] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showAboutFields, setShowAboutFields] = useState(false)
  const [form, setForm] = useState<any>(BLANK)
  const [me, setMe] = useState<any>(null)
  const [showAddChild, setShowAddChild] = useState(false)
  const [childForm, setChildForm] = useState({ display_name:'', date_of_birth:'', notes:'' })
  const [convertEmail, setConvertEmail] = useState('')
  const [converting, setConverting] = useState(false)
  const [saving, setSaving] = useState(false)

  const addChild = async () => {
    if (!childForm.display_name || saving) return
    setSaving(true)
    try {
      const fid = await getFamilyId()
      await supabase.from('managed_persons').insert({
        family_id: fid, created_by: me?.id,
        display_name: childForm.display_name,
        date_of_birth: childForm.date_of_birth || null,
        notes: childForm.notes,
      })
      setShowAddChild(false); setChildForm({ display_name:'', date_of_birth:'', notes:'' }); load()
    } finally {
      setSaving(false)
    }
  }

  const convertToAccount = async () => {
    if (!convertEmail) return
    setConverting(true)
    try {
      // Create the real account via the create-account-direct edge function
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      const fid = await getFamilyId()
      const res = await fetch(`${supabaseUrl}/functions/v1/convert-child`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({
          managedId: selected.id,
          email: convertEmail,
          displayName: selected.display_name,
          familyId: fid,
        }),
      })
      const result = await res.json()
      if (result.success) {
        alert(`Account created! ${selected.display_name} can now log in with ${convertEmail} using the temporary password sent to them. All their tagged memories are now on their account.`)
        setSelected(null); setConvertEmail(''); load()
      } else {
        alert('Could not convert: ' + (result.error ?? 'unknown error'))
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setConverting(false)
    }
  }

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  const load = async () => {
    const { data } = await supabase.from('contacts').select('*, preferences:contact_preferences(*)').order('first_name')

    const { data: u } = await supabase.auth.getUser()
    const { data: meData } = await supabase.from('users').select('id, family_id').eq('id', u.user!.id).single()
    setMe(meData)

    const { data: nets } = await supabase.from('family_networks')
      .select('family_id_a, family_id_b')
      .or(`family_id_a.eq.${meData?.family_id},family_id_b.eq.${meData?.family_id}`)
    const networkFamilyIds = (nets ?? []).map((n: any) =>
      n.family_id_a === meData?.family_id ? n.family_id_b : n.family_id_a
    )
    const allFamilyIds = [meData?.family_id, ...networkFamilyIds]

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
        person_key: `member-${m.id}`,
        first_name: m.display_name?.split(' ')[0] ?? m.display_name,
        last_name: m.display_name?.split(' ').slice(1).join(' ') ?? '',
        relationship: m.family_id === meData?.family_id ? 'Family' : `${(m.family as any)?.name ?? 'Network'} Family`,
        is_family_member: m.family_id === meData?.family_id,
        isMember: true,
        about,
      }
    })

    const dbContacts = (data ?? []).map((c: any) => ({ ...c, person_key: `contact-${c.id}` }))

    // Managed children (no login, this family only)
    const { data: managed } = await supabase.from('managed_persons')
      .select('*').eq('family_id', meData?.family_id).is('converted_user_id', null)
    const managedContacts = (managed ?? []).map((m: any) => ({
      ...m,
      id: m.id,
      person_key: `managed-${m.id}`,
      first_name: m.display_name?.split(' ')[0] ?? m.display_name,
      last_name: m.display_name?.split(' ').slice(1).join(' ') ?? '',
      relationship: 'Child (managed)',
      is_family_member: true,
      isManaged: true,
    }))

    setContacts([...memberContacts, ...managedContacts, ...dbContacts])
  }

  useEffect(() => { load() }, [])

  const handleSelect = async (c: any) => {
    setSelected(c)
    setNewNote('')
    // Load notes about this person (visible to whole family)
    const { data: noteData } = await supabase.from('person_notes')
      .select('*, author:users!author_id(display_name)')
      .eq('person_key', c.person_key)
      .order('created_at', { ascending: false })
    setNotes(noteData ?? [])
    if (c.isMember) { setGifts([]); return }
    const { data } = await supabase.from('gifts').select('*').eq('contact_id', c.id).order('created_at', { ascending: false })
    setGifts(data ?? [])
  }

  const addNote = async () => {
    if (!newNote.trim()) return
    const fid = await getFamilyId()
    await supabase.from('person_notes').insert({
      family_id: fid, author_id: me.id, person_key: selected.person_key, note: newNote.trim(), is_private: notePrivate,
    })
    setNewNote('')
    handleSelect(selected)
  }

  const deleteNote = async (id: string) => {
    await supabase.from('person_notes').delete().eq('id', id)
    handleSelect(selected)
  }

  const handleAdd = async () => {
    if (!form.first_name || saving) return
    setSaving(true)
    try {
      const fid = await getFamilyId()
      await supabase.from('contacts').insert({ ...form, family_id: fid, created_by: me?.id, date_of_birth: form.date_of_birth || null })
      setShowAdd(false); setShowAboutFields(false); setForm(BLANK); load()
    } finally {
      setSaving(false)
    }
  }

  // Build the "about" rows for display — from member's about_me OR contact's own fields
  const buildAboutRows = (c: any) => {
    const src = c.isMember ? (c.about ?? {}) : c
    return ABOUT_FIELDS.map(f => src[f.key] ? { label: f.label, value: src[f.key] } : null).filter(Boolean) as any[]
  }

  if (selected) {
    const aboutRows = buildAboutRows(selected)
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <button onClick={() => setSelected(null)} className="text-[#6366F1] mb-6 hover:underline">← Back</button>
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full bg-[#6366F1] flex items-center justify-center text-white font-black text-3xl mb-3">{selected.first_name[0]}{selected.last_name?.[0]??''}</div>
          <h1 className="text-2xl font-bold text-[#F1F5F9]">{selected.first_name} {selected.last_name}</h1>
          {selected.relationship && <p className="text-[#64748B] mt-1">{selected.relationship}</p>}
          {selected.isMember && <span className="mt-2 text-xs font-semibold text-[#6366F1] bg-[#1E1B4B] px-3 py-1 rounded-full">On LM · profile they filled out</span>}
          {selected.isManaged && <span className="mt-2 text-xs font-semibold text-[#F59E0B] bg-[#3A2A0F] px-3 py-1 rounded-full">Managed child · no login yet</span>}
        </div>

        {/* Convert managed child to real account (admins only) */}
        {selected.isManaged && me?.role === 'admin' && (
          <div className="mb-6 bg-[#1E1B4B]/30 border border-[#6366F1]/30 rounded-xl p-4">
            <h2 className="text-sm font-bold text-[#A5B4FC] mb-1">Give {selected.first_name} their own account</h2>
            <p className="text-xs text-[#64748B] mb-3">Creates a real login. Every memory {selected.first_name} is tagged in moves to their new account automatically.</p>
            <div className="flex gap-2">
              <input value={convertEmail} onChange={e => setConvertEmail(e.target.value)} placeholder="Their email" className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              <button onClick={convertToAccount} disabled={converting} className="bg-[#6366F1] text-white text-sm font-bold px-4 rounded-lg disabled:opacity-50">{converting ? '...' : 'Create'}</button>
            </div>
          </div>
        )}

        {/* Contact Info */}
        {(selected.date_of_birth || selected.phone || selected.email || selected.address) && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wide mb-3">Contact Info</h2>
            <div className="space-y-2">
              {selected.date_of_birth && <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex justify-between"><span className="text-[#64748B]">🎂 Birthday</span><span className="text-[#F1F5F9] font-semibold">{new Date(selected.date_of_birth).toLocaleDateString()}</span></div>}
              {selected.phone && <a href={`tel:${selected.phone}`} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex justify-between hover:border-[#6366F1]"><span className="text-[#64748B]">📞 Phone</span><span className="text-[#F1F5F9] font-semibold">{selected.phone}</span></a>}
              {selected.email && <a href={`mailto:${selected.email}`} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex justify-between hover:border-[#6366F1]"><span className="text-[#64748B]">✉️ Email</span><span className="text-[#F1F5F9] font-semibold">{selected.email}</span></a>}
              {selected.address && <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4"><span className="text-[#64748B] block mb-1">📍 Address</span><span className="text-[#F1F5F9]">{selected.address}</span></div>}
            </div>
          </div>
        )}

        {/* About Me */}
        {aboutRows.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wide mb-3">About {selected.first_name}</h2>
            <div className="space-y-2">
              {aboutRows.map((p, i) => <div key={i} className="bg-[#1E293B] border border-[#334155] rounded-xl p-3 flex justify-between"><span className="text-[#94A3B8]">{p.label}</span><span className="text-[#F1F5F9] font-semibold text-right">{p.value}</span></div>)}
            </div>
          </div>
        )}

        {/* Notes — anyone in family can add about this person */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wide mb-3">Notes</h2>
          <div className="flex gap-2 mb-2">
            <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key==='Enter' && addNote()} placeholder={`Add a note about ${selected.first_name}...`} className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
            <button onClick={addNote} className="bg-[#6366F1] text-white text-sm font-bold px-4 rounded-lg">Add</button>
          </div>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setNotePrivate(false)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${!notePrivate ? 'bg-[#6366F1] text-white' : 'bg-[#0F172A] text-[#64748B]'}`}>👨‍👩‍👧 Shared with family</button>
            <button onClick={() => setNotePrivate(true)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${notePrivate ? 'bg-[#6366F1] text-white' : 'bg-[#0F172A] text-[#64748B]'}`}>🔒 Just me</button>
          </div>
          <div className="space-y-2">
            {notes.map(n => (
              <div key={n.id} className={`border rounded-xl p-3 ${n.is_private ? 'bg-[#1E1B4B]/40 border-[#6366F1]/30' : 'bg-[#1E293B] border-[#334155]'}`}>
                <div className="flex justify-between items-start">
                  <span className="text-[#F1F5F9] text-sm">{n.note}</span>
                  {n.author_id === me?.id && <button onClick={() => deleteNote(n.id)} className="text-[#64748B] hover:text-red-400 text-xs ml-2">✕</button>}
                </div>
                <div className="text-xs text-[#475569] mt-1">
                  {n.is_private ? '🔒 Private · ' : ''}— {n.author?.display_name} · {new Date(n.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
            {notes.length === 0 && <div className="text-[#475569] italic text-sm">No notes yet</div>}
          </div>
        </div>

        {/* Gift Ideas — only for non-member contacts */}
        {!selected.isMember && (
          <div>
            <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wide mb-3">Gift Ideas</h2>
            {gifts.length === 0 ? <div className="text-[#475569] italic text-sm">No gift ideas yet</div> : gifts.map(g => <div key={g.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-3 flex justify-between mb-2"><span className="text-[#F1F5F9]">{g.title}</span><span className={`text-xs font-semibold capitalize ${g.status==='purchased'?'text-green-400':'text-[#64748B]'}`}>{g.status}</span></div>)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">People</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowAddChild(!showAddChild); setShowAdd(false) }} className="bg-[#1E293B] border border-[#6366F1]/40 text-[#A5B4FC] text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#312E81]">+ Child</button>
          <button onClick={() => { setShowAdd(!showAdd); setShowAddChild(false) }} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#4F46E5]">+ Add</button>
        </div>
      </div>

      {showAddChild && (
        <div className="bg-[#1E293B] border border-[#6366F1]/30 rounded-xl p-4 mb-6 space-y-3">
          <div className="text-sm font-bold text-[#A5B4FC]">Add a young child</div>
          <p className="text-xs text-[#64748B]">For kids too young for their own login. Store their info and tag them in memories. You can turn this into a real account later.</p>
          <input value={childForm.display_name} onChange={e => setChildForm(p=>({...p,display_name:e.target.value}))} placeholder="Child's name *" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <div>
            <label className="text-xs text-[#94A3B8] block mb-1">Birthday</label>
            <input value={childForm.date_of_birth} onChange={e => setChildForm(p=>({...p,date_of_birth:e.target.value}))} type="date" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
          </div>
          <textarea value={childForm.notes} onChange={e => setChildForm(p=>({...p,notes:e.target.value}))} placeholder="Notes (favorites, allergies, anything to remember)" rows={2} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1] resize-none" />
          <div className="flex gap-2">
            <button onClick={addChild} disabled={saving} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">{saving?"Saving...":"Save Child"}</button>
            <button onClick={() => setShowAddChild(false)} className="text-[#64748B] text-sm px-4 py-2 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-6 space-y-3">
          <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Basic Info</div>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.first_name} onChange={e => setForm((p:any)=>({...p,first_name:e.target.value}))} placeholder="First name *" className="bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
            <input value={form.last_name} onChange={e => setForm((p:any)=>({...p,last_name:e.target.value}))} placeholder="Last name" className="bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          </div>
          <input value={form.relationship} onChange={e => setForm((p:any)=>({...p,relationship:e.target.value}))} placeholder="Relationship (Grandma, Coach, Friend...)" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />

          <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide pt-2">Contact Info</div>
          <input value={form.phone} onChange={e => setForm((p:any)=>({...p,phone:e.target.value}))} placeholder="Phone" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <input value={form.email} onChange={e => setForm((p:any)=>({...p,email:e.target.value}))} placeholder="Email" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <input value={form.address} onChange={e => setForm((p:any)=>({...p,address:e.target.value}))} placeholder="Address" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <input value={form.date_of_birth} onChange={e => setForm((p:any)=>({...p,date_of_birth:e.target.value}))} type="date" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />

          {/* Optional About Me for non-connected friends */}
          <button onClick={() => setShowAboutFields(!showAboutFields)} className="text-[#6366F1] text-sm font-semibold">
            {showAboutFields ? '− Hide' : '+ Add'} About Me details (for friends not on LM)
          </button>
          {showAboutFields && (
            <div className="space-y-2 border-t border-[#334155] pt-3">
              {ABOUT_FIELDS.map(f => (
                <input key={f.key} value={form[f.key]} onChange={e => setForm((p:any)=>({...p,[f.key]:e.target.value}))} placeholder={f.label} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              ))}
            </div>
          )}

          <textarea value={form.notes} onChange={e => setForm((p:any)=>({...p,notes:e.target.value}))} placeholder="Quick note" rows={2} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1] resize-none" />

          <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide pt-1">Who can see this person?</div>
          <div className="flex gap-2">
            <button onClick={() => setForm((p:any)=>({...p,is_private:false}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold ${!form.is_private ? 'bg-[#6366F1] text-white' : 'bg-[#0F172A] text-[#64748B]'}`}>👨‍👩‍👧 Whole family</button>
            <button onClick={() => setForm((p:any)=>({...p,is_private:true}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold ${form.is_private ? 'bg-[#6366F1] text-white' : 'bg-[#0F172A] text-[#64748B]'}`}>🔒 Just me</button>
          </div>

          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">{saving?"Saving...":"Save"}</button>
            <button onClick={() => { setShowAdd(false); setShowAboutFields(false); setForm(BLANK) }} className="text-[#64748B] text-sm px-4 py-2 rounded-lg">Cancel</button>
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
      {contact.isMember && <span className="text-xs text-[#6366F1]">LM</span>}
      {contact.is_private && <span className="text-xs text-[#64748B]" title="Only you can see this">🔒</span>}
      <span className="text-[#475569]">›</span>
    </button>
  )
}
