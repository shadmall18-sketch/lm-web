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

function timeLabelChore(t: string) {
  if (!t) return ''
  let [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'; h = h % 12; if (h===0) h = 12
  return `${h}:${String(m).padStart(2,'0')}${ampm}`
}

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
  const [choreView, setChoreView] = useState<'week'|'all'|'calendar'>('week')
  const [editing, setEditing] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>(null)
  const [calMonth, setCalMonth] = useState(new Date())
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

  const openEdit = (chore: any) => {
    setEditing(chore)
    setEditForm({
      title: chore.title, points_value: String(chore.points_value ?? 0),
      assigned_to: chore.assigned_to, due_date: chore.due_date ?? '',
      due_time: chore.due_time ?? '', reminder_minutes: chore.reminder_minutes != null ? String(chore.reminder_minutes) : '',
    })
  }

  const saveEdit = async () => {
    if (saving) return
    setSaving(true)
    try {
      await supabase.from('chores').update({
        title: editForm.title,
        points_value: parseInt(editForm.points_value) || 0,
        assigned_to: editForm.assigned_to,
        due_date: editForm.due_date || null,
        due_time: editForm.due_time || null,
        reminder_minutes: editForm.reminder_minutes ? parseInt(editForm.reminder_minutes) : null,
      }).eq('id', editing.id)
      setEditing(null); setEditForm(null); load()
    } finally { setSaving(false) }
  }

  const deleteChore = async (chore: any) => {
    if (chore.series_id) {
      if (confirm('Delete this and all future repeats in the series? Cancel = just this one.')) {
        await supabase.from('chores').delete().eq('series_id', chore.series_id).gte('due_date', chore.due_date)
      } else {
        await supabase.from('chores').delete().eq('id', chore.id)
      }
    } else {
      await supabase.from('chores').delete().eq('id', chore.id)
    }
    setEditing(null); setEditForm(null); load()
  }

  // Week range (Sun–Sat of current week)
  const weekRange = () => {
    const now = new Date()
    const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0)
    const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999)
    return { start, end }
  }
  const inThisWeek = (c: any) => {
    if (!c.due_date) return true // undated chores always show
    const { start, end } = weekRange()
    const d = new Date(c.due_date + 'T12:00:00')
    return d >= start && d <= end
  }

  const visibleChores = choreView === 'week' ? chores.filter(inThisWeek) : chores
  const pending = visibleChores.filter(c => c.status === 'pending')
  const completed = visibleChores.filter(c => c.status === 'completed')
  const isAdmin = user?.role === 'admin'

  // Calendar helpers for chores-only calendar
  const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const choresFor = (dateStr: string) => chores.filter(c => c.due_date === dateStr).sort((a,b) => (a.due_time||'').localeCompare(b.due_time||''))

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
            <div className="flex bg-[#1E293B] rounded-lg p-1 border border-[#334155]">
              {(['week','all','calendar'] as const).map(v => (
                <button key={v} onClick={() => setChoreView(v)} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${choreView===v?'bg-[#6366F1] text-white':'text-[#64748B]'}`}>{v==='week'?'This Week':v==='all'?'All':'Calendar'}</button>
              ))}
            </div>
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

          {choreView !== 'calendar' && <h2 className="font-bold text-[#94A3B8] mb-3">Pending ({pending.length})</h2>}
          {choreView !== 'calendar' && <div className="space-y-2">
            {pending.map(chore => (
              <div key={chore.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#F1F5F9]">{chore.title}{chore.series_id && <span className="text-xs text-[#475569] ml-1">🔁</span>}</div>
                  <div className="text-sm text-[#64748B] mt-0.5">
                    👤 {chore.assigned_user?.display_name}
                    {chore.due_date && ` · Due ${new Date(chore.due_date+'T12:00:00').toLocaleDateString()}`}
                    {chore.due_time && ` ${timeLabelChore(chore.due_time)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {chore.points_value > 0 && <span className="text-xs font-bold text-[#A5B4FC] bg-[#312E81] px-2 py-1 rounded-lg">+{chore.points_value} / −{Math.round(chore.points_value/2)}</span>}
                  {isAdmin && <button onClick={() => openEdit(chore)} className="text-[#64748B] hover:text-[#F1F5F9] text-sm">✏️</button>}
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
            {pending.length === 0 && <div className="text-[#475569] text-sm italic p-4 bg-[#1E293B] rounded-xl border border-[#334155]">No pending chores {choreView==='week'?'this week ':''}🎉</div>}
          </div>}

          {choreView !== 'calendar' && completed.length > 0 && (
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
          {choreView === 'calendar' && (
            <ChoreCalendar calMonth={calMonth} setCalMonth={setCalMonth} choresFor={choresFor} fmtD={fmtD} onEdit={isAdmin ? openEdit : null} />
          )}
        </div>
      )}

      {/* Edit chore modal */}
      {editing && editForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setEditing(null); setEditForm(null) }}>
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#F1F5F9] mb-4">Edit chore</h3>
            <div className="space-y-3">
              <input value={editForm.title} onChange={e => setEditForm((p:any)=>({...p,title:e.target.value}))} placeholder="Chore title" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
              <select value={editForm.assigned_to} onChange={e => setEditForm((p:any)=>({...p,assigned_to:e.target.value}))} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]">
                {members.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-[#94A3B8] block mb-1">Points</label>
                  <input value={editForm.points_value} onChange={e => setEditForm((p:any)=>({...p,points_value:e.target.value}))} type="number" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[#94A3B8] block mb-1">Due date</label>
                  <input value={editForm.due_date} onChange={e => setEditForm((p:any)=>({...p,due_date:e.target.value}))} type="date" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
                </div>
              </div>
              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Time (blank = any time that day)</label>
                <select value={editForm.due_time} onChange={e => setEditForm((p:any)=>({...p,due_time:e.target.value}))} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]">
                  <option value="">Any time that day</option>
                  {TIME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            {editing.series_id && <p className="text-xs text-[#F59E0B] mt-3">🔁 This is part of a repeating series. Edits apply to this one occurrence.</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={saveEdit} disabled={saving} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">{saving?'Saving...':'Save changes'}</button>
              <button onClick={() => deleteChore(editing)} className="bg-[#1E293B] border border-red-500/40 text-red-400 text-sm font-bold px-4 py-2 rounded-lg">Delete</button>
              <button onClick={() => { setEditing(null); setEditForm(null) }} className="text-[#64748B] text-sm px-4 py-2 rounded-lg ml-auto">Cancel</button>
            </div>
          </div>
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

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CAL_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function ChoreCalendar({ calMonth, setCalMonth, choresFor, fmtD, onEdit }: any) {
  const y = calMonth.getFullYear(), m = calMonth.getMonth()
  const first = new Date(y, m, 1)
  const startPad = first.getDay()
  const totalDays = new Date(y, m+1, 0).getDate()
  const gridStart = new Date(first); gridStart.setDate(1 - startPad)
  const totalCells = Math.ceil((startPad + totalDays) / 7) * 7
  const cells: Date[] = []
  for (let i=0;i<totalCells;i++){ const d = new Date(gridStart); d.setDate(gridStart.getDate()+i); cells.push(d) }
  const todayStr = fmtD(new Date())

  return (
    <div className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[#334155]">
        <button onClick={() => setCalMonth(new Date(y, m-1, 1))} className="text-2xl text-[#6366F1] px-3 hover:bg-[#0F172A] rounded-lg">‹</button>
        <span className="font-bold text-[#F1F5F9]">{CAL_MONTHS[m]} {y}</span>
        <button onClick={() => setCalMonth(new Date(y, m+1, 1))} className="text-2xl text-[#6366F1] px-3 hover:bg-[#0F172A] rounded-lg">›</button>
      </div>
      <div className="grid grid-cols-7 border-b border-[#334155]">
        {CAL_DAYS.map(d => <div key={d} className="text-center text-xs text-[#64748B] py-2 font-semibold">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const ds = fmtD(d)
          const dayChores = choresFor(ds)
          const dim = d.getMonth() !== m
          const isToday = ds === todayStr
          return (
            <div key={i} className="min-h-[84px] p-1 flex flex-col border border-[#334155]/30">
              <span className={`text-xs font-semibold px-1 ${isToday ? 'text-white bg-[#EC4899] rounded-full w-5 h-5 flex items-center justify-center' : dim ? 'text-[#475569]' : 'text-[#94A3B8]'}`}>{d.getDate()}</span>
              <div className="flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                {dayChores.slice(0,3).map((c: any) => (
                  <button key={c.id} onClick={() => onEdit && onEdit(c)} className={`rounded px-1 py-0.5 text-[9px] leading-tight font-medium text-white truncate text-left ${c.status==='completed'?'opacity-50':''}`} style={{backgroundColor: c.status==='completed' ? '#10B981' : '#EC4899'}} title={c.title}>
                    {c.due_time ? timeLabelChore(c.due_time)+' ' : '○ '}{c.title}
                  </button>
                ))}
                {dayChores.length > 3 && <div className="text-[9px] text-[#64748B] px-1">+{dayChores.length-3} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
