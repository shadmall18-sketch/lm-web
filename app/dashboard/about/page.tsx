'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const FIELDS = [
  { key: 'favorite_color', label: 'Favorite Color', placeholder: 'Teal' },
  { key: 'favorite_snacks', label: 'Favorite Snacks', placeholder: 'Hot Cheetos, popcorn' },
  { key: 'favorite_foods', label: 'Favorite Foods', placeholder: 'Pizza, sushi, tacos' },
  { key: 'favorite_drinks', label: 'Favorite Drinks', placeholder: 'Coffee, lemonade' },
  { key: 'favorite_activities', label: 'Favorite Activities', placeholder: 'Hiking, gaming, reading' },
  { key: 'favorite_with_others', label: 'Favorite Things to Do With Others', placeholder: 'Game nights, movies, road trips' },
  { key: 'hobbies', label: 'Hobbies', placeholder: '3D printing, painting' },
  { key: 'favorite_movie', label: 'Favorite Movie / Show', placeholder: 'The Princess Bride' },
  { key: 'favorite_music', label: 'Favorite Music', placeholder: 'Country, hip-hop' },
  { key: 'dream_vacation', label: 'Dream Vacation', placeholder: 'Hawaii' },
  { key: 'clothing_size', label: 'Clothing Size', placeholder: 'Large' },
  { key: 'shoe_size', label: 'Shoe Size', placeholder: '10.5' },
  { key: 'allergies', label: 'Allergies', placeholder: 'Peanuts' },
]

export default function AboutMePage() {
  const supabase = createClient()
  const [form, setForm] = useState<any>({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  const load = async () => {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return
    const { data } = await supabase.from('about_me').select('*').eq('user_id', sess.session.user.id).single()
    if (data) setForm(data)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    setSaving(true)
    const { data: u } = await supabase.auth.getUser()
    const fid = await getFamilyId()
    const payload = { ...form, user_id: u.user!.id, family_id: fid, updated_at: new Date().toISOString() }
    delete payload.id; delete payload.created_at
    await supabase.from('about_me').upsert(payload, { onConflict: 'user_id' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#F1F5F9] mb-1">About Me</h1>
      <p className="text-[#64748B] text-sm mb-6">This info shows on your contact card for family and connected families.</p>

      <div className="space-y-4">
        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1.5">{f.label}</label>
            <input
              value={form[f.key] ?? ''}
              onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]"
            />
          </div>
        ))}
        <div>
          <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1.5">About Me</label>
          <textarea
            value={form.bio ?? ''}
            onChange={e => setForm((p: any) => ({ ...p, bio: e.target.value }))}
            placeholder="Anything else you want your family to know..."
            rows={3}
            className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#6366F1] resize-none"
          />
        </div>

        <button onClick={handleSave} disabled={saving} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50">
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}
