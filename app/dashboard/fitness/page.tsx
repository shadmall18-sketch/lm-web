'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const TODAY = new Date().toISOString().split('T')[0]
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function uuid() {
  return crypto.randomUUID()
}

export default function FitnessPage() {
  const supabase = createClient()
  const [uid, setUid] = useState('')
  const [familyId, setFamilyId] = useState('')
  const [exercises, setExercises] = useState<any[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [planned, setPlanned] = useState<any[]>([])
  const [meals, setMeals] = useState<any[]>([])
  const [date, setDate] = useState(TODAY)
  const [section, setSection] = useState<'today'|'calendar'|'stats'>('today')
  const [monthWorkouts, setMonthWorkouts] = useState<any[]>([])
  const [monthMeals, setMonthMeals] = useState<any[]>([])
  const [calMonth, setCalMonth] = useState(new Date())
  const [statPeriod, setStatPeriod] = useState<'week'|'month'>('week')
  const [editingW, setEditingW] = useState<any>(null)
  const [editWForm, setEditWForm] = useState<any>(null)

  // Add panel state
  const [showAdd, setShowAdd] = useState(false)
  const [mode, setMode] = useState<'log'|'schedule'|'block'>('log')
  const [search, setSearch] = useState('')
  const [showFavsOnly, setShowFavsOnly] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customCals, setCustomCals] = useState('')

  // Schedule options
  const [schedTime, setSchedTime] = useState('07:00')
  const [recurrence, setRecurrence] = useState('none')
  const [recurDays, setRecurDays] = useState<number[]>([])
  const [recurEnd, setRecurEnd] = useState('')
  const [blockLabel, setBlockLabel] = useState('Workout')
  const [workoutPoints, setWorkoutPoints] = useState('0')
  const [reminderMins, setReminderMins] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  const [selectedExercise, setSelectedExercise] = useState<any>(null)
  const [assignTo, setAssignTo] = useState<'me'|'family'>('me')
  const [visibility, setVisibility] = useState<'private'|'family'>('private')

  // visibility prompt
  // fill-in-later modal for a time block
  const [fillBlock, setFillBlock] = useState<any>(null)

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  const load = async () => {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return
    const userId = sess.session.user.id
    setUid(userId)
    const fid = await getFamilyId()
    setFamilyId(fid)

    const [{ data: e }, { data: p }, { data: m }, { data: fav }, { data: mem }] = await Promise.all([
      supabase.from('exercise_library').select('*').order('category').order('name'),
      supabase.from('planned_workouts').select('*').eq('scheduled_date', date).order('scheduled_time'),
      supabase.from('planned_meals').select('*').eq('user_id', userId).eq('planned_date', date),
      supabase.from('favorites').select('item_id').eq('user_id', userId).eq('item_type', 'exercise'),
      supabase.from('users').select('id, display_name, is_child, role, family_id').eq('id', userId).single(),
    ])
    setExercises(e ?? [])
    // Show my workouts + any family-visible workouts from others
    setPlanned((p ?? []).filter((w:any) => w.user_id === userId || w.visibility === 'family'))
    setMeals(m ?? [])
    setFavorites((fav ?? []).map((x: any) => x.item_id))
    setMembers(mem ? [mem] : [])
    // Load all family members for assignment dropdown
    if (mem?.family_id) {
      const { data: fam } = await supabase.from('users').select('id, display_name, is_child').eq('family_id', mem.family_id).order('is_child').order('display_name')
      setFamilyMembers(fam ?? [])
    }
  }

  useEffect(() => { load() }, [date])

  const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

  // Load a wide window for stats + calendar (prev/this/next month)
  const loadRange = async () => {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return
    const userId = sess.session.user.id
    const y = calMonth.getFullYear(), m = calMonth.getMonth()
    const rangeStart = fmtLocal(new Date(y, m-1, 1))
    const rangeEnd = fmtLocal(new Date(y, m+2, 0))
    const [{ data: w }, { data: ml }] = await Promise.all([
      supabase.from('planned_workouts').select('*').gte('scheduled_date', rangeStart).lte('scheduled_date', rangeEnd),
      supabase.from('planned_meals').select('*').eq('user_id', userId).gte('planned_date', rangeStart).lte('planned_date', rangeEnd),
    ])
    setMonthWorkouts((w ?? []).filter((x:any) => x.user_id === userId || x.visibility === 'family'))
    setMonthMeals(ml ?? [])
  }
  useEffect(() => { loadRange() }, [calMonth, date])

  // Period ranges
  const periodRange = () => {
    const now = new Date()
    if (statPeriod === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0)
      const end = new Date(start); end.setDate(start.getDate()+6); end.setHours(23,59,59,999)
      return { start, end, daysTotal: 7 }
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth()+1, 0); end.setHours(23,59,59,999)
    return { start, end, daysTotal: end.getDate() }
  }

  const statsData = () => {
    const { start, end, daysTotal } = periodRange()
    const inRange = (ds: string) => { const d = new Date(ds+'T12:00:00'); return d >= start && d <= end }
    const wk = monthWorkouts.filter(w => inRange(w.scheduled_date))
    const ml = monthMeals.filter(m => inRange(m.planned_date))
    const burnedDone = wk.filter(w => w.completed).reduce((s,w) => s + (w.calories ?? 0), 0)
    const burnedPlanned = wk.reduce((s,w) => s + (w.calories ?? 0), 0) // all scheduled (incl. not yet done)
    const consumed = ml.reduce((s,m) => s + (m.calories ?? 0), 0)
    // days elapsed so far in the period
    const now = new Date()
    const msDay = 24*60*60*1000
    const daysElapsed = Math.min(daysTotal, Math.max(1, Math.floor((now.getTime() - start.getTime())/msDay) + 1))
    // projected = current daily average * total days
    const projConsumed = Math.round(consumed / daysElapsed * daysTotal)
    const projBurned = Math.round(burnedDone / daysElapsed * daysTotal)
    return { burnedDone, burnedPlanned, consumed, projConsumed, projBurned, daysElapsed, daysTotal }
  }

  const workoutsForCal = (ds: string) => monthWorkouts.filter(w => w.scheduled_date === ds).sort((a,b) => (a.scheduled_time||'').localeCompare(b.scheduled_time||''))

  // Edit a workout
  const openEditW = (w: any) => {
    setEditingW(w)
    setEditWForm({ custom_name: w.custom_name, calories: String(w.calories ?? ''), points_value: String(w.points_value ?? 0), scheduled_time: w.scheduled_time ?? '', scheduled_date: w.scheduled_date ?? '' })
  }
  const saveEditW = async () => {
    await supabase.from('planned_workouts').update({
      custom_name: editWForm.custom_name,
      calories: editWForm.calories ? parseInt(editWForm.calories) : null,
      points_value: parseInt(editWForm.points_value) || 0,
      scheduled_time: editWForm.scheduled_time || null,
      scheduled_date: editWForm.scheduled_date || null,
    }).eq('id', editingW.id)
    setEditingW(null); setEditWForm(null); load(); loadRange()
  }

  const toggleFav = async (exId: string, e: any) => {
    e.stopPropagation()
    if (favorites.includes(exId)) {
      await supabase.from('favorites').delete().eq('user_id', uid).eq('item_type', 'exercise').eq('item_id', exId)
    } else {
      await supabase.from('favorites').insert({ user_id: uid, family_id: familyId, item_type: 'exercise', item_id: exId })
    }
    load()
  }

  // Format a Date as local YYYY-MM-DD (no UTC shift)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

  // Generate the list of dates for a recurring workout
  const buildDates = (startDate: string): string[] => {
    if (recurrence === 'none') return [startDate]
    const dates: string[] = []
    const start = new Date(startDate + 'T00:00:00')
    const end = recurEnd ? new Date(recurEnd + 'T00:00:00') : new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000) // default 90 days
    let cursor = new Date(start)
    let iter = 0
    while (cursor <= end && iter < 500) {
      iter++
      const dow = cursor.getDay()
      const dateStr = fmt(cursor)
      // whole days since the start date
      const daysSinceStart = Math.round((cursor.getTime() - start.getTime()) / (24*60*60*1000))
      if (recurrence === 'daily') dates.push(dateStr)
      else if (recurrence === 'every_other_day') { if (daysSinceStart % 2 === 0) dates.push(dateStr) }
      else if (recurrence === 'weekly') { if (dow === start.getDay()) dates.push(dateStr) }
      else if (recurrence === 'every_other_week') { if (dow === start.getDay() && (Math.floor(daysSinceStart / 7) % 2 === 0)) dates.push(dateStr) }
      else if (recurrence === 'custom_days') { if (recurDays.includes(dow)) dates.push(dateStr) }
      cursor.setDate(cursor.getDate() + 1)
    }
    return dates
  }

  // ---- QUICK LOG: log a workout already done (marked complete immediately) ----
  const quickLog = async (name: string, cals: number, exerciseId: string|null) => {
    await supabase.from('planned_workouts').insert({
      family_id: familyId, user_id: uid, exercise_id: exerciseId,
      custom_name: name, calories: cals, scheduled_date: date,
      visibility: 'private', show_on_calendar: true,
      completed: true, completed_at: new Date().toISOString(),
    })
    resetPanel(); load()
  }

  // ---- SCHEDULE: pick exercise (stages it; doesn't save until Add tapped) ----
  const pickExercise = (ex: any) => {
    if (mode === 'log') { quickLog(ex.name, ex.calories_est, ex.id); return }
    setSelectedExercise({ name: ex.name, calories: ex.calories_est, exercise_id: ex.id })
  }
  const pickCustom = () => {
    if (!customName || !customCals) return
    if (mode === 'log') { quickLog(customName, parseInt(customCals), null); return }
    setSelectedExercise({ name: customName, calories: parseInt(customCals), exercise_id: null })
  }

  const saveScheduled = async () => {
    const ex = selectedExercise
    if (!ex) { alert('Pick an exercise first.'); return }
    if (recurrence === 'custom_days' && recurDays.length === 0) {
      alert('Pick at least one day of the week first.')
      return
    }
    const dates = buildDates(date)
    if (dates.length === 0) {
      alert('No dates matched. Check your day selection and end date.')
      return
    }
    const sid = dates.length > 1 ? uuid() : null
    const assignees = assignTo === 'family' ? familyMembers.map(m => m.id) : [uid]
    const vis = assignTo === 'family' ? 'family' : visibility
    const rows: any[] = []
    for (const userId of assignees) {
      for (const d of dates) {
        rows.push({
          family_id: familyId, user_id: userId,
          exercise_id: ex.exercise_id ?? null,
          custom_name: ex.name, calories: ex.calories,
          scheduled_date: d, scheduled_time: schedTime || null,
          visibility: vis, show_on_calendar: true,
          points_value: parseInt(workoutPoints) || 0,
          reminder_minutes: reminderMins ? parseInt(reminderMins) : null,
          recurrence, recurrence_days: recurrence === 'custom_days' ? recurDays : null,
          recurrence_end: recurEnd || null, series_id: sid,
        })
      }
    }
    await supabase.from('planned_workouts').insert(rows)
    setSelectedExercise(null); resetPanel(); load()
  }

  // ---- TIME BLOCK: reserve a time, fill exercise in later ----
  const addTimeBlock = async () => {
    const dates = buildDates(date)
    const sid = dates.length > 1 ? uuid() : null
    const rows = dates.map(d => ({
      family_id: familyId, user_id: uid,
      custom_name: blockLabel || 'Workout', calories: null,
      scheduled_date: d, scheduled_time: schedTime || null,
      is_time_block: true, visibility: 'private', show_on_calendar: true,
      points_value: parseInt(workoutPoints) || 0,
      reminder_minutes: reminderMins ? parseInt(reminderMins) : null,
      recurrence, recurrence_days: recurrence === 'custom_days' ? recurDays : null,
      recurrence_end: recurEnd || null, series_id: sid,
    }))
    await supabase.from('planned_workouts').insert(rows)
    resetPanel(); load()
  }

  // Fill in a time block after the fact
  const completeBlock = async (name: string, cals: number, exerciseId: string|null) => {
    await supabase.from('planned_workouts').update({
      custom_name: name, calories: cals, exercise_id: exerciseId,
      is_time_block: false, completed: true, completed_at: new Date().toISOString(),
    }).eq('id', fillBlock.id)
    setFillBlock(null); load()
  }

  const resetPanel = () => {
    setShowAdd(false); setSearch(''); setCustomName(''); setCustomCals('')
    setRecurrence('none'); setRecurDays([]); setRecurEnd(''); setBlockLabel('Workout'); setWorkoutPoints('0'); setReminderMins('')
    setSelectedExercise(null); setAssignTo('me'); setVisibility('private')
  }

  const awardWorkoutPoints = async (w: any, missed: boolean) => {
    if (!w.points_value) return
    const isKid = members[0]?.is_child
    const fid = familyId
    if (missed) {
      const penalty = Math.round(w.points_value / 2)
      if (isKid) {
        await supabase.from('planned_workouts').update({ points_status: 'pending_penalty' }).eq('id', w.id)
      } else {
        await supabase.from('planned_workouts').update({ points_status: 'penalized' }).eq('id', w.id)
        await supabase.from('points_ledger').insert({ family_id: fid, user_id: uid, amount: -penalty, reason: `Missed workout: ${w.custom_name}`, reference_id: w.id, reference_type: 'workout' })
        await supabase.rpc('increment_points', { user_id: uid, amount: -penalty })
      }
    } else {
      if (isKid) {
        await supabase.from('planned_workouts').update({ points_status: 'pending_verify' }).eq('id', w.id)
      } else {
        await supabase.from('planned_workouts').update({ points_status: 'awarded' }).eq('id', w.id)
        await supabase.from('points_ledger').insert({ family_id: fid, user_id: uid, amount: w.points_value, reason: `Workout: ${w.custom_name}`, reference_id: w.id, reference_type: 'workout' })
        await supabase.rpc('increment_points', { user_id: uid, amount: w.points_value })
      }
    }
  }

  const toggleComplete = async (w: any) => {
    if (w.is_time_block) { setFillBlock(w); return }
    const nowComplete = !w.completed
    await supabase.from('planned_workouts').update({
      completed: nowComplete,
      completed_at: nowComplete ? new Date().toISOString() : null,
    }).eq('id', w.id)
    if (nowComplete && w.points_status === 'none') await awardWorkoutPoints(w, false)
    load()
  }

  const markMissed = async (w: any) => {
    await supabase.from('planned_workouts').update({ completed: false, completed_at: null }).eq('id', w.id)
    if (w.points_status === 'none') await awardWorkoutPoints(w, true)
    load()
  }

  // Parent verifies a kid's workout points
  const verifyWorkout = async (w: any) => {
    const fid = familyId
    if (w.points_status === 'pending_penalty') {
      const penalty = Math.round(w.points_value / 2)
      await supabase.from('planned_workouts').update({ points_status: 'penalized' }).eq('id', w.id)
      await supabase.from('points_ledger').insert({ family_id: fid, user_id: w.user_id, amount: -penalty, reason: `Missed workout: ${w.custom_name}`, reference_id: w.id, reference_type: 'workout' })
      await supabase.rpc('increment_points', { user_id: w.user_id, amount: -penalty })
    } else {
      await supabase.from('planned_workouts').update({ points_status: 'awarded' }).eq('id', w.id)
      await supabase.from('points_ledger').insert({ family_id: fid, user_id: w.user_id, amount: w.points_value, reason: `Workout: ${w.custom_name}`, reference_id: w.id, reference_type: 'workout' })
      await supabase.rpc('increment_points', { user_id: w.user_id, amount: w.points_value })
    }
    load()
  }

  const removeWorkout = async (w: any) => {
    if (w.series_id) {
      // ask whether to remove whole series
      if (confirm('Delete this and all future repeats in the series? Click Cancel to delete just this one.')) {
        await supabase.from('planned_workouts').delete().eq('series_id', w.series_id).gte('scheduled_date', w.scheduled_date)
      } else {
        await supabase.from('planned_workouts').delete().eq('id', w.id)
      }
    } else {
      await supabase.from('planned_workouts').delete().eq('id', w.id)
    }
    load()
  }

  const burned = planned.filter(w => w.completed).reduce((s, w) => s + (w.calories ?? 0), 0)
  const consumed = meals.reduce((s, m) => s + m.calories, 0)
  const net = consumed - burned

  let displayEx = exercises
  if (showFavsOnly) displayEx = exercises.filter(e => favorites.includes(e.id))
  if (search) displayEx = displayEx.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
  displayEx = [...displayEx].sort((a, b) => (favorites.includes(a.id) ? 0 : 1) - (favorites.includes(b.id) ? 0 : 1))

  const toggleDay = (d: number) => setRecurDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Fitness</h1>
        {section==='today' && <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />}
      </div>

      <div className="flex bg-[#1E293B] rounded-lg p-1 mb-6 border border-[#334155]">
        {(['today','calendar','stats'] as const).map(s => (
          <button key={s} onClick={() => setSection(s)} className={`flex-1 py-2 rounded-md text-xs font-semibold ${section===s?'bg-[#6366F1] text-white':'text-[#64748B]'}`}>{s==='today'?'Today':s==='calendar'?'Calendar':'Stats'}</button>
        ))}
      </div>

      {section==='today' && (<>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1E293B] rounded-2xl p-4 border-l-4 border-[#F59E0B]">
          <div className="text-xs text-[#64748B] uppercase font-semibold">Burned</div>
          <div className="text-2xl font-black text-[#F59E0B] mt-1">{burned}</div>
        </div>
        <div className="bg-[#1E293B] rounded-2xl p-4 border-l-4 border-[#10B981]">
          <div className="text-xs text-[#64748B] uppercase font-semibold">Consumed</div>
          <div className="text-2xl font-black text-[#10B981] mt-1">{consumed}</div>
        </div>
        <div className="bg-[#1E293B] rounded-2xl p-4 border-l-4" style={{ borderColor: net > 0 ? '#6366F1' : '#10B981' }}>
          <div className="text-xs text-[#64748B] uppercase font-semibold">Net</div>
          <div className="text-2xl font-black mt-1" style={{ color: net > 0 ? '#6366F1' : '#10B981' }}>{net > 0 ? '+' : ''}{net}</div>
        </div>
      </div>

      <button onClick={() => setShowAdd(!showAdd)} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-bold px-4 py-2.5 rounded-xl mb-6">+ Add Workout</button>

      {showAdd && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-6 space-y-4">
          {/* Mode selector */}
          <div className="flex gap-1 bg-[#0F172A] rounded-xl p-1">
            <button onClick={() => setMode('log')} className={`flex-1 py-2 rounded-lg text-xs font-semibold ${mode==='log'?'bg-[#6366F1] text-white':'text-[#64748B]'}`}>⚡ Log Now</button>
            <button onClick={() => setMode('schedule')} className={`flex-1 py-2 rounded-lg text-xs font-semibold ${mode==='schedule'?'bg-[#6366F1] text-white':'text-[#64748B]'}`}>📅 Schedule</button>
            <button onClick={() => setMode('block')} className={`flex-1 py-2 rounded-lg text-xs font-semibold ${mode==='block'?'bg-[#6366F1] text-white':'text-[#64748B]'}`}>⏰ Time Block</button>
          </div>

          <div className="text-xs text-[#64748B]">
            {mode==='log' && 'Log a workout you already did — it counts toward calories burned right away.'}
            {mode==='schedule' && 'Plan a workout for a day/time. Can repeat. Check it off when done.'}
            {mode==='block' && 'Reserve a workout time now, add what you did + calories later.'}
          </div>

          {/* Schedule + recurrence options (schedule & block modes) */}
          {(mode==='schedule' || mode==='block') && (
            <div className="space-y-3 border border-[#334155] rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#94A3B8] w-16">Start date</span>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-1.5 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#94A3B8] w-16">Time</span>
                <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} className="bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-1.5 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#94A3B8] w-16">Repeat</span>
                <select value={recurrence} onChange={e => setRecurrence(e.target.value)} className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-1.5 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]">
                  <option value="none">Doesn't repeat</option>
                  <option value="daily">Daily</option>
                  <option value="every_other_day">Every other day</option>
                  <option value="weekly">Weekly (same weekday)</option>
                  <option value="every_other_week">Every other week</option>
                  <option value="custom_days">Specific days of week</option>
                </select>
              </div>
              {recurrence==='custom_days' && (
                <div className="flex gap-1 flex-wrap">
                  {WEEKDAYS.map((d, i) => (
                    <button key={i} onClick={() => toggleDay(i)} className={`w-9 h-9 rounded-full text-xs font-semibold ${recurDays.includes(i)?'bg-[#6366F1] text-white':'bg-[#0F172A] text-[#64748B]'}`}>{d[0]}</button>
                  ))}
                </div>
              )}
              {recurrence!=='none' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#94A3B8] w-16">Until</span>
                  <input type="date" value={recurEnd} onChange={e => setRecurEnd(e.target.value)} className="bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-1.5 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
                  <span className="text-xs text-[#475569]">(blank = 60 days)</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#94A3B8] w-16">Points</span>
                <input type="number" value={workoutPoints} onChange={e => setWorkoutPoints(e.target.value)} placeholder="0" className="w-24 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-1.5 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
                {parseInt(workoutPoints) > 0 && <span className="text-xs text-[#475569]">+{workoutPoints} done · −{Math.round(parseInt(workoutPoints)/2)} missed</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#94A3B8] w-16">🔔 Remind</span>
                <select value={reminderMins} onChange={e => setReminderMins(e.target.value)} className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-1.5 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]">
                  <option value="">No reminder</option>
                  <option value="0">At start time</option>
                  <option value="15">15 min before</option>
                  <option value="30">30 min before</option>
                  <option value="60">1 hour before</option>
                </select>
              </div>
              {mode==='schedule' && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#94A3B8] w-16">For</span>
                    <div className="flex gap-2 flex-1">
                      <button onClick={() => setAssignTo('me')} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${assignTo==='me'?'bg-[#6366F1] text-white':'bg-[#0F172A] text-[#64748B]'}`}>Just me</button>
                      <button onClick={() => setAssignTo('family')} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${assignTo==='family'?'bg-[#6366F1] text-white':'bg-[#0F172A] text-[#64748B]'}`}>👨‍👩‍👧 Whole family</button>
                    </div>
                  </div>
                  {assignTo==='me' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#94A3B8] w-16">Visible to</span>
                      <div className="flex gap-2 flex-1">
                        <button onClick={() => setVisibility('private')} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${visibility==='private'?'bg-[#6366F1] text-white':'bg-[#0F172A] text-[#64748B]'}`}>🔒 Only me</button>
                        <button onClick={() => setVisibility('family')} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${visibility==='family'?'bg-[#6366F1] text-white':'bg-[#0F172A] text-[#64748B]'}`}>👀 Family can see</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TIME BLOCK: just a label + save */}
          {mode==='block' ? (
            <div className="space-y-3">
              <input value={blockLabel} onChange={e => setBlockLabel(e.target.value)} placeholder="Label (e.g. Morning Workout)" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              <button onClick={addTimeBlock} className="w-full bg-[#6366F1] text-white text-sm font-bold py-2.5 rounded-lg">Reserve Time Block</button>
            </div>
          ) : (
            <>
              {/* Exercise picker for log & schedule */}
              <div className="flex gap-2">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search or scroll the list..." className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
                <button onClick={() => setShowFavsOnly(!showFavsOnly)} className={`px-3 rounded-lg text-sm font-semibold ${showFavsOnly?'bg-[#F59E0B] text-white':'bg-[#0F172A] text-[#94A3B8]'}`}>★</button>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1 border border-[#334155] rounded-lg p-2">
                {displayEx.map(ex => {
                  const isSel = mode==='schedule' && selectedExercise && selectedExercise.exercise_id === ex.id
                  return (
                  <div key={ex.id} className="flex items-center gap-2">
                    <button onClick={(e) => toggleFav(ex.id, e)} className="text-lg px-1">{favorites.includes(ex.id)?'⭐':'☆'}</button>
                    <button onClick={() => pickExercise(ex)} className={`flex-1 flex justify-between items-center rounded-lg px-3 py-2 text-left border ${isSel ? 'bg-[#312E81] border-[#6366F1]' : 'bg-[#0F172A] border-transparent hover:bg-[#0A0F1E]'}`}>
                      <div><div className="text-sm text-[#F1F5F9]">{ex.name} {isSel && '✓'}</div><div className="text-xs text-[#475569]">{ex.category}</div></div>
                      <span className="text-sm font-bold text-[#F59E0B]">{ex.calories_est} cal</span>
                    </button>
                  </div>
                )})}
                {displayEx.length === 0 && <div className="text-center text-[#475569] text-sm py-4 italic">No exercises match</div>}
              </div>
              <div className="border-t border-[#334155] pt-3">
                <div className="text-xs text-[#64748B] uppercase font-semibold mb-2">Or custom</div>
                <div className="flex gap-2">
                  <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Workout name" className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
                  <input value={customCals} onChange={e => setCustomCals(e.target.value)} placeholder="Cals" type="number" className="w-20 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
                  <button onClick={pickCustom} className="bg-[#6366F1] text-white text-sm font-bold px-4 rounded-lg">{mode==='log'?'Log':'Select'}</button>
                </div>
              </div>

              {/* Schedule mode: show selection + explicit Add button */}
              {mode==='schedule' && (
                <div className="border-t border-[#334155] pt-3">
                  {selectedExercise ? (
                    <div className="flex items-center justify-between bg-[#312E81] rounded-lg px-3 py-2 mb-3">
                      <span className="text-sm text-[#F1F5F9]">Selected: <span className="font-bold">{selectedExercise.name}</span> · {selectedExercise.calories} cal</span>
                      <button onClick={() => setSelectedExercise(null)} className="text-[#A5B4FC] text-xs">change</button>
                    </div>
                  ) : (
                    <div className="text-xs text-[#475569] italic mb-3">Pick an exercise above, then tap Add to Calendar.</div>
                  )}
                  <button onClick={saveScheduled} disabled={!selectedExercise} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-bold py-2.5 rounded-lg disabled:opacity-40">
                    📅 Add to Calendar
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Fill-in-block modal */}
      {fillBlock && (
        <FillBlockModal
          exercises={exercises}
          onClose={() => setFillBlock(null)}
          onSave={completeBlock}
        />
      )}

      <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-3">Scheduled — {planned.length} this day</div>
      <div className="space-y-2">
        {planned.map(w => (
          <div key={w.id} className={`border rounded-xl p-4 flex items-center justify-between ${w.is_time_block ? 'bg-[#1E1B4B]/30 border-dashed border-[#6366F1]/40' : 'bg-[#1E293B] border-[#334155]'}`}>
            <div className="flex items-center gap-3">
              <button onClick={() => toggleComplete(w)} className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${w.completed ? 'bg-[#10B981] border-[#10B981]' : 'border-[#475569]'}`}>
                {w.completed && <span className="text-white text-xs">✓</span>}
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${w.completed ? 'text-[#64748B] line-through' : 'text-[#F1F5F9]'}`}>{w.custom_name}</span>
                  {w.is_time_block && <span className="text-[10px] font-bold text-[#A5B4FC] bg-[#312E81] px-1.5 py-0.5 rounded">TAP TO FILL IN</span>}
                  {w.series_id && <span className="text-xs text-[#475569]">🔁</span>}
                </div>
                <div className="text-xs text-[#475569]">
                  {w.scheduled_time && w.scheduled_time.slice(0,5)} {w.visibility==='family' ? '· 👨‍👩‍👧' : '· 🔒'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {w.points_value > 0 && w.points_status === 'none' && <span className="text-xs font-bold text-[#A5B4FC] bg-[#312E81] px-2 py-0.5 rounded">+{w.points_value}/−{Math.round(w.points_value/2)}</span>}
              {w.points_status === 'awarded' && <span className="text-xs font-bold text-[#10B981]">+{w.points_value} ✓</span>}
              {w.points_status === 'penalized' && <span className="text-xs font-bold text-red-400">−{Math.round(w.points_value/2)}</span>}
              {w.points_status === 'pending_verify' && (members[0]?.role === 'admin' ? <button onClick={() => verifyWorkout(w)} className="bg-[#F59E0B] text-white text-xs font-bold px-2 py-1 rounded">Verify ✓</button> : <span className="text-xs text-[#F59E0B]">Pending</span>)}
              {w.points_status === 'pending_penalty' && (members[0]?.role === 'admin' ? <button onClick={() => verifyWorkout(w)} className="bg-red-500/80 text-white text-xs font-bold px-2 py-1 rounded">Confirm</button> : <span className="text-xs text-red-400">Pending</span>)}
              {!w.completed && !w.is_time_block && w.points_value > 0 && w.points_status === 'none' && (
                <button onClick={() => markMissed(w)} className="text-red-400 border border-red-500/40 text-xs font-bold px-2 py-1 rounded">Missed</button>
              )}
              {w.calories != null && <span className="text-sm font-bold text-[#F59E0B]">{w.calories} cal</span>}
              <button onClick={() => openEditW(w)} className="text-[#64748B] hover:text-[#F1F5F9] text-sm">✏️</button>
              <button onClick={() => removeWorkout(w)} className="text-[#64748B] hover:text-red-400 text-sm">✕</button>
            </div>
          </div>
        ))}
        {planned.length === 0 && <div className="text-center text-[#475569] italic py-8">Nothing yet — add a workout above</div>}
      </div>
      </>)}

      {section==='calendar' && (
        <WorkoutCalendar calMonth={calMonth} setCalMonth={setCalMonth} workoutsForCal={workoutsForCal} fmtLocal={fmtLocal} onEdit={openEditW} />
      )}

      {section==='stats' && (() => {
        const s = statsData()
        const net = s.consumed - s.burnedDone
        const projNet = s.projConsumed - s.projBurned
        return (
          <div className="space-y-5">
            <div className="flex bg-[#1E293B] rounded-lg p-1 border border-[#334155] w-fit">
              {(['week','month'] as const).map(p => (
                <button key={p} onClick={() => setStatPeriod(p)} className={`px-4 py-1.5 rounded-md text-xs font-semibold ${statPeriod===p?'bg-[#6366F1] text-white':'text-[#64748B]'}`}>This {p}</button>
              ))}
            </div>

            <div>
              <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">So far this {statPeriod} ({s.daysElapsed} of {s.daysTotal} days)</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#1E293B] rounded-2xl p-4 border-l-4 border-[#F59E0B]">
                  <div className="text-xs text-[#64748B] uppercase font-semibold">Burned</div>
                  <div className="text-2xl font-black text-[#F59E0B] mt-1">{s.burnedDone}</div>
                </div>
                <div className="bg-[#1E293B] rounded-2xl p-4 border-l-4 border-[#10B981]">
                  <div className="text-xs text-[#64748B] uppercase font-semibold">Consumed</div>
                  <div className="text-2xl font-black text-[#10B981] mt-1">{s.consumed}</div>
                </div>
                <div className="bg-[#1E293B] rounded-2xl p-4 border-l-4" style={{borderColor: net>0?'#6366F1':'#10B981'}}>
                  <div className="text-xs text-[#64748B] uppercase font-semibold">Net</div>
                  <div className="text-2xl font-black mt-1" style={{color: net>0?'#6366F1':'#10B981'}}>{net>0?'+':''}{net}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Projected full {statPeriod} (at current pace)</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#1E293B]/60 rounded-2xl p-4 border-l-4 border-[#F59E0B]/50">
                  <div className="text-xs text-[#64748B] uppercase font-semibold">Burned</div>
                  <div className="text-2xl font-black text-[#F59E0B] mt-1">{s.projBurned}</div>
                </div>
                <div className="bg-[#1E293B]/60 rounded-2xl p-4 border-l-4 border-[#10B981]/50">
                  <div className="text-xs text-[#64748B] uppercase font-semibold">Consumed</div>
                  <div className="text-2xl font-black text-[#10B981] mt-1">{s.projConsumed}</div>
                </div>
                <div className="bg-[#1E293B]/60 rounded-2xl p-4 border-l-4" style={{borderColor: projNet>0?'#6366F1':'#10B981'}}>
                  <div className="text-xs text-[#64748B] uppercase font-semibold">Net</div>
                  <div className="text-2xl font-black mt-1" style={{color: projNet>0?'#6366F1':'#10B981'}}>{projNet>0?'+':''}{projNet}</div>
                </div>
              </div>
            </div>

            <div className="bg-[#1E1B4B]/30 border border-[#6366F1]/30 rounded-xl p-4 text-sm text-[#A5B4FC]">
              {projNet > 0
                ? <>You're trending toward a <span className="font-bold">surplus of {projNet} cal</span> this {statPeriod}. To balance it out, that's about <span className="font-bold">{Math.ceil(projNet / 400)}</span> more workout{Math.ceil(projNet/400)===1?'':'s'} (~400 cal each) to add.</>
                : <>You're trending toward a <span className="font-bold">deficit of {Math.abs(projNet)} cal</span> this {statPeriod} — burning more than you're eating at the current pace.</>}
            </div>
          </div>
        )
      })()}

      {/* Edit workout modal (works from any section) */}
      {editingW && editWForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setEditingW(null); setEditWForm(null) }}>
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#F1F5F9] mb-4">Edit workout</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Workout</label>
                <input value={editWForm.custom_name} onChange={e => setEditWForm((p:any)=>({...p,custom_name:e.target.value}))} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-[#94A3B8] block mb-1">Calories</label>
                  <input value={editWForm.calories} onChange={e => setEditWForm((p:any)=>({...p,calories:e.target.value}))} type="number" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[#94A3B8] block mb-1">Points</label>
                  <input value={editWForm.points_value} onChange={e => setEditWForm((p:any)=>({...p,points_value:e.target.value}))} type="number" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-[#94A3B8] block mb-1">Date</label>
                  <input value={editWForm.scheduled_date} onChange={e => setEditWForm((p:any)=>({...p,scheduled_date:e.target.value}))} type="date" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[#94A3B8] block mb-1">Time</label>
                  <input value={editWForm.scheduled_time ? editWForm.scheduled_time.slice(0,5) : ''} onChange={e => setEditWForm((p:any)=>({...p,scheduled_time:e.target.value}))} type="time" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
                </div>
              </div>
            </div>
            {editingW.series_id && <p className="text-xs text-[#F59E0B] mt-3">🔁 Part of a repeating series. Edits apply to this one occurrence.</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={saveEditW} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg">Save changes</button>
              <button onClick={() => { removeWorkout(editingW); setEditingW(null); setEditWForm(null) }} className="bg-[#1E293B] border border-red-500/40 text-red-400 text-sm font-bold px-4 py-2 rounded-lg">Delete</button>
              <button onClick={() => { setEditingW(null); setEditWForm(null) }} className="text-[#64748B] text-sm px-4 py-2 rounded-lg ml-auto">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FillBlockModal({ exercises, onClose, onSave }: any) {
  const [search, setSearch] = useState('')
  const [customName, setCustomName] = useState('')
  const [customCals, setCustomCals] = useState('')
  const filtered = search ? exercises.filter((e: any) => e.name.toLowerCase().includes(search.toLowerCase())) : exercises

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-[#F1F5F9] mb-1">What did you do?</h3>
        <p className="text-sm text-[#64748B] mb-4">Add the workout and calories for this time block.</p>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exercises..." className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm mb-2 focus:outline-none focus:border-[#6366F1]" />
        <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
          {filtered.map((ex: any) => (
            <button key={ex.id} onClick={() => onSave(ex.name, ex.calories_est, ex.id)} className="w-full flex justify-between items-center bg-[#0F172A] hover:bg-[#0A0F1E] rounded-lg px-3 py-2 text-left">
              <span className="text-sm text-[#F1F5F9]">{ex.name}</span>
              <span className="text-sm font-bold text-[#F59E0B]">{ex.calories_est} cal</span>
            </button>
          ))}
        </div>
        <div className="border-t border-[#334155] pt-3">
          <div className="text-xs text-[#64748B] uppercase font-semibold mb-2">Or custom</div>
          <div className="flex gap-2">
            <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Name" className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
            <input value={customCals} onChange={e => setCustomCals(e.target.value)} placeholder="Cals" type="number" className="w-20 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
            <button onClick={() => customName && customCals && onSave(customName, parseInt(customCals), null)} className="bg-[#6366F1] text-white text-sm font-bold px-4 rounded-lg">Save</button>
          </div>
        </div>
        <button onClick={onClose} className="w-full mt-3 text-[#64748B] text-sm py-2">Cancel</button>
      </div>
    </div>
  )
}

const WC_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WC_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function wcTime(t: string) {
  if (!t) return ''
  let [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'; h = h % 12; if (h===0) h=12
  return `${h}:${String(m).padStart(2,'0')}${ampm}`
}

function WorkoutCalendar({ calMonth, setCalMonth, workoutsForCal, fmtLocal, onEdit }: any) {
  const y = calMonth.getFullYear(), m = calMonth.getMonth()
  const first = new Date(y, m, 1)
  const startPad = first.getDay()
  const totalDays = new Date(y, m+1, 0).getDate()
  const gridStart = new Date(first); gridStart.setDate(1 - startPad)
  const totalCells = Math.ceil((startPad + totalDays) / 7) * 7
  const cells: Date[] = []
  for (let i=0;i<totalCells;i++){ const d = new Date(gridStart); d.setDate(gridStart.getDate()+i); cells.push(d) }
  const todayStr = fmtLocal(new Date())

  return (
    <div className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[#334155]">
        <button onClick={() => setCalMonth(new Date(y, m-1, 1))} className="text-2xl text-[#6366F1] px-3 hover:bg-[#0F172A] rounded-lg">‹</button>
        <span className="font-bold text-[#F1F5F9]">{WC_MONTHS[m]} {y}</span>
        <button onClick={() => setCalMonth(new Date(y, m+1, 1))} className="text-2xl text-[#6366F1] px-3 hover:bg-[#0F172A] rounded-lg">›</button>
      </div>
      <div className="grid grid-cols-7 border-b border-[#334155]">
        {WC_DAYS.map(d => <div key={d} className="text-center text-xs text-[#64748B] py-2 font-semibold">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const ds = fmtLocal(d)
          const dayW = workoutsForCal(ds)
          const dim = d.getMonth() !== m
          const isToday = ds === todayStr
          return (
            <div key={i} className="min-h-[84px] p-1 flex flex-col border border-[#334155]/30">
              <span className={`text-xs font-semibold px-1 ${isToday ? 'text-white bg-[#F59E0B] rounded-full w-5 h-5 flex items-center justify-center' : dim ? 'text-[#475569]' : 'text-[#94A3B8]'}`}>{d.getDate()}</span>
              <div className="flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                {dayW.slice(0,3).map((w: any) => (
                  <button key={w.id} onClick={() => onEdit(w)} className={`rounded px-1 py-0.5 text-[9px] leading-tight font-medium text-white truncate text-left ${w.completed?'opacity-50':''}`} style={{backgroundColor: w.is_time_block ? '#A5B4FC' : '#F59E0B'}} title={w.custom_name}>
                    {w.scheduled_time ? wcTime(w.scheduled_time)+' ' : ''}{w.custom_name}
                  </button>
                ))}
                {dayW.length > 3 && <div className="text-[9px] text-[#64748B] px-1">+{dayW.length-3} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
