'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

// 15-min increments, 12-hour labels
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (const min of [0, 15, 30, 45]) {
      const value = `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`
      let hh = h % 12; if (hh === 0) hh = 12
      const ampm = h < 12 ? 'AM' : 'PM'
      out.push({ value, label: `${hh}:${String(min).padStart(2,'0')} ${ampm}` })
    }
  }
  return out
})()

export default function ChoresPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [chores, setChores] = useState<any[]>([])
  const [rewards, setRewards] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [tab, setTab] = useState<'chores'|'rewards'>('chores')
  const [showAdd, setShowAdd] = useState(false)
  const [showAddReward, setShowAddReward] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title:'', points_value:'10', assigned_to:'', due_date:'', due_time:'', reminder_minutes:'', recurrence:'none', recurrence_end:'' })
  const [recurDays, setRecurDays] = useState<number[]>([])
  const [anyTime, setAnyTime] = useState(true)
  const [rewardForm, setRewardForm] = useState({ title:'', points_cost:'50', description:'' })

  const load = async () => {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return
    const uid = sess.session.user.id
    const [{ data: profile }, { data: c }, { data: r }, { data: m }] = await Promise.all([
      supabase.from('users').select('*').eq('id', uid).single(),
      supabase.from('chores').select('*, assigned_user:users!assigned_to(display_name)').order('due_date', { ascending: true }),
      supabase.from('rewards').select('*').eq('is_active', true),
      supabase.from('users').select('*'),
    ])
    setUser(profile); setChores(c ?? []); setRewards(r ?? []); setMembers(m ?? [])
  }

  useEffect(() => { load() }, [])

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  const handleComplete = async (chore: any) => {
    // Adults self-mark and get points immediately; kids go to pending verify
    const assignee = members.find(m => m.id === chore.assigned_to)
    const isKid = assignee?.is_child
    if (isKid) {
      await supabase.from('chores').update({ status:'completed', completed_at: new Date().toISOString(), points_status: 'pending_verify' }).eq('id', chore.id)
    } else {
      await supabase.from('chores').update({ status:'completed', completed_at: new Date().toISOString(), points_status: 'awarded' }).eq('id', chore.id)
      if (chore.points_value > 0) {
        const fid = await getFamilyId()
        await supabase.from('points_ledger').insert({ family_id: fid, user_id: chore.assigned_to, amount: chore.points_value, reason: `Completed: ${chore.title}`, reference_id: chore.id, reference_type: 'chore' })
        await supabase.rpc('increment_points', { user_id: chore.assigned_to, amount: chore.points_value })
      }
    }
    load()
  }

  const handleMissed = async (chore: any) => {
    const penalty = Math.round((chore.points_value || 0) / 2)
    const assignee = members.find(m => m.id === chore.assigned_to)
    const isKid = assignee?.is_child
    // Kids' penalties also need a parent to confirm; adults self-report
    if (isKid) {
      await supabase.from('chores').update({ status:'completed', completed_at: new Date().toISOString(), points_status: 'pending_penalty' }).eq('id', chore.id)
    } else {
      await supabase.from('chores').update({ status:'completed', completed_at: new Date().toISOString(), points_status: 'penalized' }).eq('id', chore.id)
      if (penalty > 0) {
        const fid = await getFamilyId()
        await supabase.from('points_ledger').insert({ family_id: fid, user_id: chore.assigned_to, amount: -penalty, reason: `Missed: ${chore.title}`, reference_id: chore.id, reference_type: 'chore' })
        await supabase.rpc('increment_points', { user_id: chore.assigned_to, amount: -penalty })
      }
    }
    load()
  }

  const handleVerify = async (chore: any) => {
    const { data: u } = await supabase.auth.getUser()
    const fid = await getFamilyId()
    if (chore.points_status === 'pending_penalty') {
      const penalty = Math.round((chore.points_value || 0) / 2)
      await supabase.from('chores').update({ verified_by: u.user!.id, points_status: 'penalized' }).eq('id', chore.id)
      if (penalty > 0) {
        await supabase.from('points_ledger').insert({ family_id: fid, user_id: chore.assigned_to, amount: -penalty, reason: `Missed: ${chore.title}`, reference_id: chore.id, reference_type: 'chore' })
        await supabase.rpc('increment_points', { user_id: chore.assigned_to, amount: -penalty })
      }
    } else {
      await supabase.from('chores').update({ verified_by: u.user!.id, points_status: 'awarded' }).eq('id', chore.id)
      if (chore.points_value > 0) {
        await supabase.from('points_ledger').insert({ family_id: fid, user_id: chore.assigned_to, amount: chore.points_value, reason: `Completed: ${chore.title}`, reference_id: chore.id, reference_type: 'chore' })
        await supabase.rpc('increment_points', { user_id: chore.assigned_to, amount: chore.points_value })
      }
    }
    load()
  }

  const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const toggleDay = (d: number) => setRecurDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

  const buildChoreDates = (startDate: string): string[] => {
    const rec = form.recurrence
    if (rec === 'none') return [startDate]
    const dates: string[] = []
    const start = new Date(startDate + 'T00:00:00')
    const end = form.recurrence_end ? new Date(form.recurrence_end + 'T00:00:00') : new Date(start.getTime() + 90*24*60*60*1000)
    let cursor = new Date(start)
    let iter = 0
    while (cursor <= end && iter < 500) {
      iter++
      const dow = cursor.getDay()
      const dateStr = fmt(cursor)
      const daysSinceStart = Math.round((cursor.getTime() - start.getTime()) / (24*60*60*1000))
      if (rec === 'daily') dates.push(dateStr)
      else if (rec === 'every_other_day') { if (daysSinceStart % 2 === 0) dates.push(dateStr) }
      else if (rec === 'weekly') { if (dow === start.getDay()) dates.push(dateStr) }
      else if (rec === 'every_other_week') { if (dow === start.getDay() && (Math.floor(daysSinceStart/7) % 2 === 0)) dates.push(dateStr) }
      else if (rec === 'custom_days') { if (recurDays.includes(dow)) dates.push(dateStr) }
      cursor.setDate(cursor.getDate() + 1)
    }
    return dates
  }

  const handleAddChore = async () => {
    if (!form.title || !form.assigned_to || saving) return
    if (form.recurrence === 'custom_days' && recurDays.length === 0) { alert('Pick at least one day of the week.'); return }
    if (form.recurrence !== 'none' && !form.due_date) { alert('Pick a start date for the repeating chore.'); return }
    setSaving(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const fid = await getFamilyId()
      const dates = form.due_date ? buildChoreDates(form.due_date) : [null]
      const sid = dates.length > 1 ? crypto.randomUUID() : null
      const rows = dates.map(d => ({
        title: form.title, points_value: parseInt(form.points_value)||0,
        assigned_to: form.assigned_to, due_date: d, due_time: anyTime ? null : (form.due_time || null),
        reminder_minutes: (!anyTime && form.reminder_minutes) ? parseInt(form.reminder_minutes) : null,
        recurrence: form.recurrence, recurrence_days: form.recurrence === 'custom_days' ? recurDays : null,
        recurrence_end: form.recurrence_end || null, series_id: sid,
        family_id: fid, created_by: u.user!.id,
      }))
      await supabase.from('chores').insert(rows)
      setShowAdd(false); setForm({ title:'', points_value:'10', assigned_to:'', due_date:'', due_time:'', reminder_minutes:'', recurrence:'none', recurrence_end:'' }); setRecurDays([]); setAnyTime(true); load()
    } finally {
      setSaving(false)
    }
  }

  const handleAddReward = async () => {
    if (!rewardForm.title || saving) return
    setSaving(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const fid = await getFamilyId()
      await supabase.from('rewards').insert({ title: rewardForm.title, description: rewardForm.description, points_cost: parseInt(rewardForm.points_cost)||50, family_id: fid, created_by: u.user!.id })
      setShowAddReward(false); setRewardForm({ title:'', points_cost:'50', description:'' }); load()
    } finally {
      setSaving(false)
    }
  }

  const pending = chores.filter(c => c.status === 'pending')
  const completed = chores.filter(c => c.status === 'completed')
  const isAdmin = user?.role === 'admin'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Chores & Rewards</h1>
        <div className="bg-[#312E81] px-3 py-1.5 rounded-lg text-[#A5B4FC] text-sm font-bold">{user?.points_balance ?? 0} pts</div>
      </div>

      <div className="flex bg-[#1E293B] rounded-xl p-1 mb-6 border border-[#334155]">
        {(['chores','rewards'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab===t ? 'bg-[#6366F1] text-white' : 'text-[#64748B]'}`}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      {tab === 'chores' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#94A3B8]">Pending ({pending.length})</h2>
            {isAdmin && <button onClick={() => setShowAdd(!showAdd)} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#4F46E5]">+ Add Chore</button>}
          </div>

          {showAdd && (
            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-4 space-y-3">
              <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} placeholder="Chore title" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              <select value={form.assigned_to} onChange={e => setForm(p=>({...p,assigned_to:e.target.value}))} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]">
                <option value="">Assign to...</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
              <div className="flex gap-3">
                <input value={form.points_value} onChange={e => setForm(p=>({...p,points_value:e.target.value}))} placeholder="Points" type="number" className="w-24 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
                <input value={form.due_date} onChange={e => setForm(p=>({...p,due_date:e.target.value}))} type="date" className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={anyTime} onChange={e => setAnyTime(e.target.checked)} className="w-4 h-4 accent-[#6366F1]" />
                <span className="text-sm text-[#F1F5F9]">Any time that day (no set time)</span>
              </label>
              {!anyTime && (
                <div className="flex gap-3">
                  <select value={form.due_time} onChange={e => setForm(p=>({...p,due_time:e.target.value}))} className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]">
                    <option value="">Pick a time...</option>
                    {TIME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <select value={form.reminder_minutes} onChange={e => setForm(p=>({...p,reminder_minutes:e.target.value}))} className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]">
                    <option value="">🔔 No reminder</option>
                    <option value="0">At due time</option>
                    <option value="30">30 min before</option>
                    <option value="60">1 hour before</option>
                    <option value="1440">1 day before</option>
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#94A3B8] w-16">Repeat</span>
                <select value={form.recurrence} onChange={e => setForm(p=>({...p,recurrence:e.target.value}))} className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]">
                  <option value="none">Doesn't repeat</option>
                  <option value="daily">Daily</option>
                  <option value="every_other_day">Every other day</option>
                  <option value="weekly">Weekly (same weekday)</option>
                  <option value="every_other_week">Every other week</option>
                  <option value="custom_days">Specific days of week</option>
                </select>
              </div>
              {form.recurrence === 'custom_days' && (
                <div className="flex gap-1 flex-wrap">
                  {WEEKDAYS.map((d, i) => (
                    <button key={i} onClick={() => toggleDay(i)} className={`w-9 h-9 rounded-full text-xs font-semibold ${recurDays.includes(i)?'bg-[#6366F1] text-white':'bg-[#0F172A] text-[#64748B]'}`}>{d[0]}</button>
                  ))}
                </div>
              )}
              {form.recurrence !== 'none' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#94A3B8] w-16">Until</span>
                  <input type="date" value={form.recurrence_end} onChange={e => setForm(p=>({...p,recurrence_end:e.target.value}))} className="bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
                  <span className="text-xs text-[#475569]">(blank = 90 days)</span>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handleAddChore} disabled={saving} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">{saving?"Saving...":"Save"}</button>
                <button onClick={() => setShowAdd(false)} className="text-[#64748B] text-sm px-4 py-2 rounded-lg hover:bg-[#0F172A]">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {pending.map(chore => (
              <div key={chore.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#F1F5F9]">{chore.title}</div>
                  <div className="text-sm text-[#64748B] mt-0.5">
                    👤 {chore.assigned_user?.display_name}
                    {chore.due_date && ` · Due ${new Date(chore.due_date).toLocaleDateString()}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {chore.points_value > 0 && <span className="text-xs font-bold text-[#A5B4FC] bg-[#312E81] px-2 py-1 rounded-lg">+{chore.points_value} / −{Math.round(chore.points_value/2)}</span>}
                  {chore.assigned_to === user?.id && !chore.completed_at && (
                    <>
                      <button onClick={() => handleComplete(chore)} className="bg-[#10B981] text-white text-xs font-bold px-3 py-1.5 rounded-lg">Done</button>
                      <button onClick={() => handleMissed(chore)} className="bg-[#1E293B] border border-red-500/40 text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg">Missed</button>
                    </>
                  )}
                  {chore.completed_at && chore.points_status === 'pending_verify' && (
                    isAdmin
                      ? <button onClick={() => handleVerify(chore)} className="bg-[#F59E0B] text-white text-xs font-bold px-3 py-1.5 rounded-lg">Verify ✓</button>
                      : <span className="text-xs font-semibold text-[#F59E0B]">Awaiting verify</span>
                  )}
                  {chore.completed_at && chore.points_status === 'pending_penalty' && (
                    isAdmin
                      ? <button onClick={() => handleVerify(chore)} className="bg-red-500/80 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Confirm miss</button>
                      : <span className="text-xs font-semibold text-red-400">Awaiting review</span>
                  )}
                </div>
              </div>
            ))}
            {pending.length === 0 && <div className="text-[#475569] text-sm italic p-4 bg-[#1E293B] rounded-xl border border-[#334155]">No pending chores 🎉</div>}
          </div>

          {completed.length > 0 && (
            <div className="mt-6">
              <h2 className="font-bold text-[#94A3B8] mb-3">Completed ({completed.length})</h2>
              <div className="space-y-2">
                {completed.map(c => (
                  <div key={c.id} className="bg-[#1E293B]/50 border border-[#334155]/50 rounded-xl p-4 flex items-center justify-between opacity-60">
                    <div className="font-semibold text-[#64748B]">✅ {c.title}</div>
                    <span className="text-xs font-bold text-[#A5B4FC]">+{c.points_value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'rewards' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#94A3B8]">Rewards</h2>
            {isAdmin && <button onClick={() => setShowAddReward(!showAddReward)} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#4F46E5]">+ Add Reward</button>}
          </div>

          {showAddReward && (
            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-4 space-y-3">
              <input value={rewardForm.title} onChange={e => setRewardForm(p=>({...p,title:e.target.value}))} placeholder="Reward title" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              <input value={rewardForm.description} onChange={e => setRewardForm(p=>({...p,description:e.target.value}))} placeholder="Description (optional)" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              <input value={rewardForm.points_cost} onChange={e => setRewardForm(p=>({...p,points_cost:e.target.value}))} placeholder="Points cost" type="number" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
              <div className="flex gap-2">
                <button onClick={handleAddReward} disabled={saving} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">{saving?"Saving...":"Save"}</button>
                <button onClick={() => setShowAddReward(false)} className="text-[#64748B] text-sm px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {rewards.map(r => (
              <div key={r.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#F1F5F9]">{r.title}</div>
                  {r.description && <div className="text-sm text-[#64748B] mt-0.5">{r.description}</div>}
                </div>
                <span className="text-sm font-bold text-[#A5B4FC] bg-[#312E81] px-3 py-1.5 rounded-lg">{r.points_cost} pts</span>
              </div>
            ))}
            {rewards.length === 0 && <div className="text-[#475569] text-sm italic p-4 bg-[#1E293B] rounded-xl border border-[#334155]">No rewards set up yet</div>}
          </div>
        </div>
      )}
    </div>
  )
}
