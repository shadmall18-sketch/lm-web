'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const CAT_COLORS: Record<string, string> = { school:'#3B82F6', sports:'#10B981', appointment:'#F59E0B', family:'#6366F1', work:'#EC4899', other:'#64748B' }

// Format time from a "HH:MM:SS" string or ISO without timezone shenanigans
function timeLabel(start: string) {
  // start is "YYYY-MM-DDTHH:MM:SS"
  const t = start.split('T')[1]
  if (!t) return ''
  let [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12; if (h === 0) h = 12
  return `${h}:${String(m).padStart(2,'0')}${ampm}`
}

export default function CalendarPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<any[]>([])
  const [anchor, setAnchor] = useState(new Date()) // controls visible period
  const [selected, setSelected] = useState(new Date())
  const [view, setView] = useState<'month'|'week'>('month')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', location: '', category: 'family', event_time: '09:00', reminder_minutes: '' })

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

  const load = async () => {
    // Load a wide window (cover whichever view) — full month +/- buffer
    const y = anchor.getFullYear(), m = anchor.getMonth()
    const rangeStart = new Date(y, m-1, 1)
    const rangeEnd = new Date(y, m+2, 0)
    const startStr = fmt(rangeStart)
    const endStr = fmt(rangeEnd)

    const { data: u } = await supabase.auth.getUser()

    const { data } = await supabase.from('calendar_events')
      .select('*').gte('start_time', rangeStart.toISOString()).lte('start_time', rangeEnd.toISOString())

    const { data: workouts } = await supabase.from('planned_workouts')
      .select('*').eq('show_on_calendar', true).gte('scheduled_date', startStr).lte('scheduled_date', endStr)

    const { data: chores } = await supabase.from('chores')
      .select('*, assigned_user:users!assigned_to(display_name)').not('due_date', 'is', null).gte('due_date', startStr).lte('due_date', endStr)

    const { data: mealsData } = await supabase.from('planned_meals')
      .select('*').or(`user_id.eq.${u.user?.id},and(visibility.eq.family)`).gte('planned_date', startStr).lte('planned_date', endStr)

    const calEvents = (data ?? []).map((e: any) => {
      const d = new Date(e.start_time)
      return {
        id: `event-${e.id}`,
        title: e.title,
        date_key: fmt(d),
        start_time: `${fmt(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:00`,
        color: e.color ?? CAT_COLORS[e.category] ?? '#6366F1',
        sub: e.location || '',
        kind: 'event',
      }
    })

    const workoutEvents = (workouts ?? [])
      .filter((w: any) => w.visibility === 'family' || w.user_id === u.user?.id)
      .map((w: any) => ({
        id: `workout-${w.id}`,
        title: w.custom_name,
        date_key: w.scheduled_date,
        start_time: `${w.scheduled_date}T${w.scheduled_time ?? '07:00:00'}`,
        color: w.is_time_block ? '#A5B4FC' : '#F59E0B',
        sub: w.calories != null ? `${w.calories} cal` : 'Tap to fill in',
        kind: 'workout',
      }))

    const choreEvents = (chores ?? []).map((c: any) => ({
      id: `chore-${c.id}`,
      title: c.title,
      date_key: c.due_date,
      // timeless chores sort first (00:00) and show "All day"
      start_time: `${c.due_date}T${c.due_time ?? '00:00:00'}`,
      allDay: !c.due_time,
      color: c.status === 'completed' ? '#10B981' : '#EC4899',
      sub: c.assigned_user?.display_name ?? '',
      kind: 'chore',
    }))

    const mealColor: Record<string,string> = { Breakfast:'#F59E0B', Lunch:'#10B981', Dinner:'#6366F1', Snack:'#EC4899' }
    const mealEvents = (mealsData ?? [])
      .filter((m:any) => m.user_id === u.user?.id || m.visibility === 'family')
      .map((m: any) => ({
        id: `meal-${m.id}`,
        title: m.is_placeholder ? `${m.meal_type} (plan)` : m.custom_name,
        date_key: m.planned_date,
        start_time: `${m.planned_date}T${m.meal_time ?? '00:00:00'}`,
        allDay: !m.meal_time,
        color: mealColor[m.meal_type] ?? '#64748B',
        sub: m.meal_type + (m.track_calories!==false && m.calories ? ` · ${m.calories} cal` : ''),
        kind: 'meal',
      }))

    setEvents([...calEvents, ...workoutEvents, ...choreEvents, ...mealEvents])
  }

  useEffect(() => { load() }, [anchor])

  const eventsFor = (dateStr: string) =>
    events.filter(e => e.date_key === dateStr).sort((a,b) => (a.start_time||'').localeCompare(b.start_time||''))

  const selectedEvents = eventsFor(fmt(selected))

  // Build the grid of days for the current view
  const buildDays = (): Date[] => {
    if (view === 'week') {
      const start = new Date(anchor)
      start.setDate(anchor.getDate() - anchor.getDay()) // Sunday
      return Array.from({length:7}, (_,i) => { const d = new Date(start); d.setDate(start.getDate()+i); return d })
    }
    // month: pad to full weeks
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const startPad = first.getDay()
    const totalDays = new Date(anchor.getFullYear(), anchor.getMonth()+1, 0).getDate()
    const cells: Date[] = []
    const gridStart = new Date(first); gridStart.setDate(1 - startPad)
    const totalCells = Math.ceil((startPad + totalDays) / 7) * 7
    for (let i=0;i<totalCells;i++){ const d = new Date(gridStart); d.setDate(gridStart.getDate()+i); cells.push(d) }
    return cells
  }
  const days = buildDays()

  const move = (dir: number) => {
    if (view === 'week') { const d = new Date(anchor); d.setDate(anchor.getDate()+dir*7); setAnchor(d) }
    else { setAnchor(new Date(anchor.getFullYear(), anchor.getMonth()+dir, 1)) }
  }

  const periodLabel = view === 'week'
    ? (() => { const s = days[0], e = days[6]; return `${MONTHS[s.getMonth()].slice(0,3)} ${s.getDate()} – ${MONTHS[e.getMonth()].slice(0,3)} ${e.getDate()}` })()
    : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  const handleAdd = async () => {
    if (!form.title) return
    const start = new Date(selected)
    const [h, m] = (form.event_time || '09:00').split(':').map(Number)
    start.setHours(h, m, 0, 0)
    await supabase.from('calendar_events').insert({
      title: form.title, location: form.location, category: form.category,
      start_time: start.toISOString(), color: CAT_COLORS[form.category],
      reminder_minutes: form.reminder_minutes ? parseInt(form.reminder_minutes) : null,
      visibility: form.category === 'family' ? 'family' : 'personal',
      family_id: await getFamilyId(), created_by: (await supabase.auth.getUser()).data.user?.id
    })
    setShowAdd(false); setForm({ title:'', location:'', category:'family', event_time:'09:00', reminder_minutes:'' }); load()
  }

  const todayStr = fmt(new Date())
  const isCurrentMonth = (d: Date) => d.getMonth() === anchor.getMonth()

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Calendar</h1>
        <div className="flex bg-[#1E293B] rounded-lg p-1 border border-[#334155]">
          {(['month','week'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-4 py-1.5 rounded-md text-xs font-semibold ${view===v?'bg-[#6366F1] text-white':'text-[#64748B]'}`}>{v.charAt(0).toUpperCase()+v.slice(1)}</button>
          ))}
        </div>
      </div>

      <div className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#334155]">
          <button onClick={() => move(-1)} className="text-2xl text-[#6366F1] px-3 hover:bg-[#0F172A] rounded-lg">‹</button>
          <span className="font-bold text-[#F1F5F9]">{periodLabel}</span>
          <button onClick={() => move(1)} className="text-2xl text-[#6366F1] px-3 hover:bg-[#0F172A] rounded-lg">›</button>
        </div>
        <div className="grid grid-cols-7 border-b border-[#334155]">
          {DAYS.map(d => <div key={d} className="text-center text-xs text-[#64748B] py-2 font-semibold">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, idx) => {
            const ds = fmt(d)
            const dayEvents = eventsFor(ds)
            const isSel = ds === fmt(selected)
            const isToday = ds === todayStr
            const dim = view === 'month' && !isCurrentMonth(d)
            const maxBars = view === 'week' ? 8 : 3
            return (
              <button key={idx} onClick={() => setSelected(new Date(d))}
                className={`min-h-[84px] ${view==='week'?'min-h-[140px]':''} p-1 flex flex-col items-stretch border border-[#334155]/30 hover:bg-[#0F172A] transition-all text-left ${isSel ? 'bg-[#0F172A] ring-1 ring-[#6366F1]' : ''}`}>
                <span className={`text-xs font-semibold px-1 ${isToday ? 'text-white bg-[#6366F1] rounded-full w-5 h-5 flex items-center justify-center' : dim ? 'text-[#475569]' : 'text-[#94A3B8]'}`}>{d.getDate()}</span>
                <div className="flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                  {dayEvents.slice(0, maxBars).map(e => (
                    <div key={e.id} className="rounded px-1 py-0.5 text-[9px] leading-tight font-medium text-white truncate" style={{backgroundColor: e.color}} title={`${e.allDay ? 'All day' : timeLabel(e.start_time)} ${e.title}`}>
                      <span className="opacity-80">{e.allDay ? '○' : timeLabel(e.start_time)}</span> {e.title}
                    </div>
                  ))}
                  {dayEvents.length > maxBars && <div className="text-[9px] text-[#64748B] px-1">+{dayEvents.length - maxBars} more</div>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[#F1F5F9]">{DAYS[selected.getDay()]}, {MONTHS[selected.getMonth()]} {selected.getDate()}</h2>
          <button onClick={() => setShowAdd(!showAdd)} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#4F46E5]">+ Add Event</button>
        </div>

        {showAdd && (
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-4 space-y-3">
            <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} placeholder="Event title" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
            <input value={form.location} onChange={e => setForm(p=>({...p,location:e.target.value}))} placeholder="Location (optional)" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-[#94A3B8] block mb-1">Time</label>
                <input type="time" value={form.event_time} onChange={e => setForm(p=>({...p,event_time:e.target.value}))} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-[#94A3B8] block mb-1">🔔 Remind</label>
                <select value={form.reminder_minutes} onChange={e => setForm(p=>({...p,reminder_minutes:e.target.value}))} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]">
                  <option value="">No reminder</option>
                  <option value="0">At start time</option>
                  <option value="15">15 min before</option>
                  <option value="30">30 min before</option>
                  <option value="60">1 hour before</option>
                  <option value="1440">1 day before</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {Object.keys(CAT_COLORS).map(cat => (
                <button key={cat} onClick={() => setForm(p=>({...p,category:cat}))} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${form.category===cat ? 'text-white' : 'bg-[#0F172A] text-[#94A3B8]'}`} style={form.category===cat ? {backgroundColor: CAT_COLORS[cat]} : {}}>{cat}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#4F46E5]">Save</button>
              <button onClick={() => setShowAdd(false)} className="text-[#64748B] text-sm px-4 py-2 rounded-lg hover:bg-[#0F172A]">Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {selectedEvents.length === 0
            ? <div className="text-[#475569] text-sm italic p-4 bg-[#1E293B] rounded-xl border border-[#334155]">Nothing scheduled — tap + Add Event</div>
            : selectedEvents.map(e => (
                <div key={e.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center gap-3">
                  <div className="w-1 h-10 rounded-full flex-shrink-0" style={{backgroundColor: e.color}} />
                  <div className="flex-1">
                    <div className="font-semibold text-[#F1F5F9]">
                      {e.kind==='workout' ? '💪 ' : e.kind==='chore' ? '✅ ' : e.kind==='meal' ? '🍽️ ' : ''}{e.title}
                    </div>
                    {e.sub && <div className="text-sm text-[#64748B]">{e.kind === 'chore' ? '👤' : e.kind === 'workout' ? '🔥' : e.kind === 'meal' ? '🍴' : '📍'} {e.sub}</div>}
                  </div>
                  <span className="text-xs text-[#64748B]">{e.allDay ? 'All day' : timeLabel(e.start_time)}</span>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )
}
