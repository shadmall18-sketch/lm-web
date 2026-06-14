'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const CAT_COLORS: Record<string, string> = { school:'#3B82F6', sports:'#10B981', appointment:'#F59E0B', family:'#6366F1', work:'#EC4899', other:'#64748B' }

export default function CalendarPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<any[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selected, setSelected] = useState(new Date())
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', location: '', category: 'family' })

  const load = async () => {
    const y = currentMonth.getFullYear(), m = currentMonth.getMonth()
    const fromDate = new Date(y,m,1).toISOString()
    const toDate = new Date(y,m+1,0).toISOString()
    const { data } = await supabase.from('calendar_events')
      .select('*').gte('start_time', fromDate).lte('start_time', toDate)

    // Pull in scheduled workouts that are marked for calendar
    const { data: u } = await supabase.auth.getUser()
    const { data: workouts } = await supabase.from('planned_workouts')
      .select('*')
      .eq('show_on_calendar', true)
      .gte('scheduled_date', `${y}-${String(m+1).padStart(2,'0')}-01`)
      .lte('scheduled_date', `${y}-${String(m+1).padStart(2,'0')}-31`)

    // Convert workouts to event-like objects
    const workoutEvents = (workouts ?? [])
      .filter((w: any) => w.visibility === 'family' || w.user_id === u.user?.id)
      .map((w: any) => ({
        id: `workout-${w.id}`,
        title: `💪 ${w.custom_name}`,
        start_time: `${w.scheduled_date}T${w.scheduled_time ?? '07:00:00'}`,
        color: w.is_time_block ? '#A5B4FC' : '#F59E0B',
        location: w.calories != null ? `${w.calories} cal` : 'Tap to fill in',
        isWorkout: true,
      }))

    setEvents([...(data ?? []), ...workoutEvents])
  }

  useEffect(() => { load() }, [currentMonth])

  const eventsFor = (day: number) => events.filter(e => {
    const d = new Date(e.start_time)
    return d.getDate()===day && d.getMonth()===currentMonth.getMonth() && d.getFullYear()===currentMonth.getFullYear()
  })

  const selectedEvents = eventsFor(selected.getDate())
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const totalDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1, 0).getDate()

  const handleAdd = async () => {
    if (!form.title) return
    const start = new Date(selected); start.setHours(9,0,0)
    await supabase.from('calendar_events').insert({ ...form, start_time: start.toISOString(), color: CAT_COLORS[form.category], family_id: await getFamilyId(), created_by: (await supabase.auth.getUser()).data.user?.id })
    setShowAdd(false); setForm({ title:'', location:'', category:'family' }); load()
  }

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Calendar</h1>
      </div>
      <div className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#334155]">
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth()-1))} className="text-2xl text-[#6366F1] px-3 hover:bg-[#0F172A] rounded-lg">‹</button>
          <span className="font-bold text-[#F1F5F9]">{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth()+1))} className="text-2xl text-[#6366F1] px-3 hover:bg-[#0F172A] rounded-lg">›</button>
        </div>
        <div className="grid grid-cols-7 border-b border-[#334155]">
          {DAYS.map(d => <div key={d} className="text-center text-xs text-[#64748B] py-2 font-semibold">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array(firstDay).fill(null).map((_,i) => <div key={`b${i}`} className="aspect-square" />)}
          {Array.from({length: totalDays}, (_,i) => i+1).map(day => {
            const dayEvents = eventsFor(day)
            const isSel = selected.getDate()===day && selected.getMonth()===currentMonth.getMonth()
            const isToday = new Date().getDate()===day && new Date().getMonth()===currentMonth.getMonth() && new Date().getFullYear()===currentMonth.getFullYear()
            return (
              <button key={day} onClick={() => setSelected(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))}
                className={`aspect-square flex flex-col items-center justify-center border border-[#334155]/30 hover:bg-[#0F172A] transition-all ${isSel ? 'bg-[#0F172A]' : ''}`}>
                <span className={`text-sm font-semibold ${isToday ? 'text-[#6366F1]' : isSel ? 'text-white' : 'text-[#94A3B8]'}`}>{day}</span>
                <div className="flex gap-0.5 mt-0.5">
                  {dayEvents.slice(0,3).map((e,i) => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: e.color ?? '#6366F1'}} />)}
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
            ? <div className="text-[#475569] text-sm italic p-4 bg-[#1E293B] rounded-xl border border-[#334155]">No events — tap + Add Event</div>
            : selectedEvents.map(e => (
              <div key={e.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center gap-3">
                <div className="w-1 h-10 rounded-full flex-shrink-0" style={{backgroundColor: e.color ?? '#6366F1'}} />
                <div>
                  <div className="font-semibold text-[#F1F5F9]">{e.title}</div>
                  {e.location && <div className="text-sm text-[#64748B]">📍 {e.location}</div>}
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
