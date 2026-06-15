'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { uploadMedia } from '@/lib/upload'

const LIST_TYPES = [
  { value: 'wish', label: '⭐ Wish List' },
  { value: 'birthday', label: '🎂 Birthday List' },
  { value: 'christmas', label: '🎄 Christmas List' },
  { value: 'custom', label: '📝 Custom List' },
]
const VIS = [
  { value: 'private', label: '🔒 Private', desc: 'Only me' },
  { value: 'family', label: '👨‍👩‍👧 Family', desc: 'My family' },
  { value: 'network', label: '🌐 Network', desc: 'Family + connected families' },
]

export default function ListsPage() {
  const supabase = createClient()
  const [me, setMe] = useState<any>(null)
  const [myLists, setMyLists] = useState<any[]>([])
  const [otherLists, setOtherLists] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [showNewList, setShowNewList] = useState(false)
  const [listForm, setListForm] = useState({ name:'', list_type:'wish', visibility:'family' })
  const [itemForm, setItemForm] = useState({ title:'', notes:'', link:'', price:'', image_url:'' })
  const [uploadingImg, setUploadingImg] = useState(false)
  const [saving, setSaving] = useState(false)
  const itemFileRef = useRef<HTMLInputElement>(null)
  const [showAddItem, setShowAddItem] = useState(false)

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  const load = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data: meData } = await supabase.from('users').select('id, display_name, family_id').eq('id', u.user!.id).single()
    setMe(meData)

    // All lists I can see (RLS filters automatically)
    const { data: lists } = await supabase.from('wishlists')
      .select('*, owner:users!owner_id(display_name)')
      .order('created_at', { ascending: false })

    setMyLists((lists ?? []).filter((l: any) => l.owner_id === meData?.id))
    setOtherLists((lists ?? []).filter((l: any) => l.owner_id !== meData?.id))
  }

  useEffect(() => { load() }, [])

  const openList = async (list: any) => {
    setSelected(list)
    setShowAddItem(false)
    const { data } = await supabase.from('wishlist_items').select('*, claimer:users!claimed_by(display_name)').eq('wishlist_id', list.id).order('priority', { ascending: false }).order('created_at')
    setItems(data ?? [])
  }

  const createList = async () => {
    if (!listForm.name || saving) return
    setSaving(true)
    try {
      const fid = await getFamilyId()
      await supabase.from('wishlists').insert({ ...listForm, family_id: fid, owner_id: me.id })
      setShowNewList(false); setListForm({ name:'', list_type:'wish', visibility:'family' }); load()
    } finally { setSaving(false) }
  }

  const deleteList = async (id: string) => {
    if (!confirm('Delete this list and all its items?')) return
    await supabase.from('wishlists').delete().eq('id', id)
    setSelected(null); load()
  }

  const handleItemImage = async (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImg(true)
    const result = await uploadMedia(file)
    setUploadingImg(false)
    if (result) setItemForm(p => ({ ...p, image_url: result.url }))
    if (itemFileRef.current) itemFileRef.current.value = ''
  }

  const addItem = async () => {
    if (!itemForm.title || saving) return
    setSaving(true)
    try {
      await supabase.from('wishlist_items').insert({ ...itemForm, wishlist_id: selected.id })
      setItemForm({ title:'', notes:'', link:'', price:'', image_url:'' }); setShowAddItem(false); openList(selected)
    } finally { setSaving(false) }
  }

  const removeItem = async (id: string) => {
    await supabase.from('wishlist_items').delete().eq('id', id)
    openList(selected)
  }

  const toggleClaim = async (item: any) => {
    if (item.claimed_by && item.claimed_by !== me.id) return // someone else claimed
    if (item.claimed_by === me.id) {
      await supabase.from('wishlist_items').update({ claimed_by: null, claimed_at: null }).eq('id', item.id)
    } else {
      await supabase.from('wishlist_items').update({ claimed_by: me.id, claimed_at: new Date().toISOString() }).eq('id', item.id)
    }
    openList(selected)
  }

  const isOwner = selected && selected.owner_id === me?.id

  // ---- LIST DETAIL VIEW ----
  if (selected) {
    const typeLabel = LIST_TYPES.find(t => t.value === selected.list_type)?.label ?? selected.name
    const visLabel = VIS.find(v => v.value === selected.visibility)
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <button onClick={() => setSelected(null)} className="text-[#6366F1] mb-6 hover:underline">← Back to lists</button>
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-[#F1F5F9]">{selected.name}</h1>
            <p className="text-[#64748B] text-sm mt-1">{isOwner ? 'Your list' : `${selected.owner?.display_name}'s list`} · {visLabel?.label}</p>
          </div>
          {isOwner && (
            <div className="flex gap-2">
              <button onClick={() => setShowAddItem(!showAddItem)} className="bg-[#6366F1] text-white text-sm font-bold px-3 py-1.5 rounded-lg">+ Item</button>
              <button onClick={() => deleteList(selected.id)} className="text-[#64748B] hover:text-red-400 text-sm px-2">🗑</button>
            </div>
          )}
        </div>

        {!isOwner && (
          <div className="bg-[#1E1B4B]/30 border border-[#6366F1]/30 rounded-lg p-3 mb-4 text-xs text-[#A5B4FC]">
            💡 Tap "I'll get this" to secretly claim a gift. {selected.owner?.display_name} won't see who claimed what.
          </div>
        )}

        {showAddItem && isOwner && (
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-4 space-y-3">
            <input value={itemForm.title} onChange={e => setItemForm(p=>({...p,title:e.target.value}))} placeholder="What do you want?" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
            <input value={itemForm.link} onChange={e => setItemForm(p=>({...p,link:e.target.value}))} placeholder="Link from Amazon, Walmart, any store (optional)" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
            <div className="flex gap-2 items-center">
              <input ref={itemFileRef} type="file" accept="image/*" onChange={handleItemImage} className="hidden" />
              {itemForm.image_url ? (
                <div className="relative">
                  <img src={itemForm.image_url} alt="" className="h-16 w-16 object-cover rounded-lg" />
                  <button onClick={() => setItemForm(p=>({...p,image_url:''}))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
                </div>
              ) : (
                <button onClick={() => itemFileRef.current?.click()} disabled={uploadingImg} className="h-16 w-16 rounded-lg border-2 border-dashed border-[#334155] flex items-center justify-center text-xl text-[#64748B] hover:border-[#6366F1] disabled:opacity-50">
                  {uploadingImg ? '⏳' : '📷'}
                </button>
              )}
              <span className="text-xs text-[#475569]">Add a photo (optional)</span>
            </div>
            <div className="flex gap-2">
              <input value={itemForm.price} onChange={e => setItemForm(p=>({...p,price:e.target.value}))} placeholder="Price (optional)" className="w-32 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              <input value={itemForm.notes} onChange={e => setItemForm(p=>({...p,notes:e.target.value}))} placeholder="Notes (size, color...)" className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
            </div>
            <button onClick={addItem} disabled={saving} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">{saving?"...":"Add Item"}</button>
          </div>
        )}

        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className={`bg-[#1E293B] border rounded-xl p-4 ${item.claimed_by && !isOwner ? 'border-[#10B981]/40' : 'border-[#334155]'}`}>
              <div className="flex items-start justify-between">
                <div className="flex gap-3 flex-1">
                  {item.image_url && <img src={item.image_url} alt="" className="h-16 w-16 object-cover rounded-lg flex-shrink-0" />}
                  <div className="flex-1">
                    <div className="font-semibold text-[#F1F5F9]">{item.title}</div>
                    {item.notes && <div className="text-sm text-[#64748B] mt-0.5">{item.notes}</div>}
                    <div className="flex gap-3 mt-1 items-center">
                      {item.price && <span className="text-xs text-[#94A3B8]">{item.price}</span>}
                      {item.link && <a href={item.link.startsWith('http')?item.link:`https://${item.link}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#6366F1] hover:underline">🔗 {storeName(item.link)} →</a>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {/* Claim button — only for non-owners */}
                  {!isOwner && (
                    item.claimed_by === me?.id ? (
                      <button onClick={() => toggleClaim(item)} className="bg-[#10B981] text-white text-xs font-bold px-3 py-1.5 rounded-lg">✓ You're getting this</button>
                    ) : item.claimed_by ? (
                      <span className="text-xs text-[#64748B] italic">Claimed by {item.claimer?.display_name}</span>
                    ) : (
                      <button onClick={() => toggleClaim(item)} className="bg-[#1E293B] border border-[#10B981]/40 text-[#10B981] text-xs font-bold px-3 py-1.5 rounded-lg">I'll get this</button>
                    )
                  )}
                  {isOwner && <button onClick={() => removeItem(item.id)} className="text-[#64748B] hover:text-red-400 text-sm">✕</button>}
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="text-center text-[#475569] italic py-12">No items yet{isOwner ? ' — add what you want above' : ''}</div>}
        </div>
      </div>
    )
  }

  // ---- LISTS OVERVIEW ----
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Lists</h1>
        <button onClick={() => setShowNewList(!showNewList)} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#4F46E5]">+ New List</button>
      </div>

      {showNewList && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-6 space-y-3">
          <input value={listForm.name} onChange={e => setListForm(p=>({...p,name:e.target.value}))} placeholder="List name (e.g. My Christmas List)" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <div>
            <label className="text-xs text-[#94A3B8] block mb-1.5">Type</label>
            <div className="flex flex-wrap gap-2">
              {LIST_TYPES.map(t => (
                <button key={t.value} onClick={() => setListForm(p=>({...p,list_type:t.value, name: p.name || t.label.replace(/^[^ ]+ /,'')}))} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${listForm.list_type===t.value?'bg-[#6366F1] text-white':'bg-[#0F172A] text-[#94A3B8]'}`}>{t.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#94A3B8] block mb-1.5">Who can see it?</label>
            <div className="flex flex-col gap-2">
              {VIS.map(v => (
                <button key={v.value} onClick={() => setListForm(p=>({...p,visibility:v.value}))} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold ${listForm.visibility===v.value?'bg-[#6366F1] text-white':'bg-[#0F172A] text-[#94A3B8]'}`}>
                  <span>{v.label}</span>
                  <span className="text-xs opacity-70">{v.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createList} disabled={saving} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">{saving?"...":"Create List"}</button>
            <button onClick={() => setShowNewList(false)} className="text-[#64748B] text-sm px-4 py-2 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {myLists.length > 0 && <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">My Lists</div>}
      <div className="space-y-2 mb-6">
        {myLists.map(l => <ListRow key={l.id} list={l} onClick={() => openList(l)} mine />)}
      </div>

      {otherLists.length > 0 && <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Family & Network Lists</div>}
      <div className="space-y-2">
        {otherLists.map(l => <ListRow key={l.id} list={l} onClick={() => openList(l)} />)}
      </div>

      {myLists.length === 0 && otherLists.length === 0 && <div className="text-center text-[#475569] italic py-12">No lists yet — create your first wish list!</div>}
    </div>
  )
}

function storeName(url: string): string {
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '')
    const map: Record<string, string> = {
      'amazon.com': 'Amazon', 'walmart.com': 'Walmart', 'target.com': 'Target',
      'etsy.com': 'Etsy', 'ebay.com': 'eBay', 'bestbuy.com': 'Best Buy',
      'nike.com': 'Nike', 'lego.com': 'LEGO', 'a.co': 'Amazon',
    }
    for (const key in map) if (host.includes(key)) return map[key]
    // Otherwise return the domain name capitalized
    const name = host.split('.')[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return 'View link'
  }
}

function ListRow({ list, onClick, mine }: any) {
  const typeIcons: Record<string, string> = { wish:'⭐', birthday:'🎂', christmas:'🎄', custom:'📝' }
  const visIcons: Record<string, string> = { private:'🔒', family:'👨‍👩‍👧', network:'🌐' }
  const typeIcon = typeIcons[list.list_type] ?? '📝'
  const visIcon = visIcons[list.visibility] ?? ''
  return (
    <button onClick={onClick} className="w-full bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center gap-3 hover:border-[#6366F1] transition-all text-left">
      <div className="text-2xl">{typeIcon}</div>
      <div className="flex-1">
        <div className="font-semibold text-[#F1F5F9]">{list.name}</div>
        <div className="text-sm text-[#64748B]">{mine ? 'Your list' : list.owner?.display_name} · {visIcon}</div>
      </div>
      <span className="text-[#475569]">›</span>
    </button>
  )
}
