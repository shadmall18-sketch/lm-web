'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const TODAY = new Date().toISOString().split('T')[0]
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function uuid() { return crypto.randomUUID() }
function fmtLocal(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function timeLabel(t: string) {
  if (!t) return ''
  let [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'; h = h % 12; if (h===0) h = 12
  return `${h}:${String(m).padStart(2,'0')}${ampm}`
}
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = []
  for (let h = 0; h < 24; h++) for (const min of [0, 15, 30, 45]) {
    const value = `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`
    let hh = h % 12; if (hh === 0) hh = 12
    out.push({ value, label: `${hh}:${String(min).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}` })
  }
  return out
})()
const MEAL_COLOR: Record<string,string> = { Breakfast:'#F59E0B', Lunch:'#10B981', Dinner:'#6366F1', Snack:'#EC4899' }

export default function NutritionPage() {
  const supabase = createClient()
  const [uid, setUid] = useState('')
  const [familyId, setFamilyId] = useState('')
  const [foods, setFoods] = useState<any[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [meals, setMeals] = useState<any[]>([])
  const [workouts, setWorkouts] = useState<any[]>([])
  const [date, setDate] = useState(TODAY)
  const [section, setSection] = useState<'today'|'calendar'|'stats'>('today')

  // add panel
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [mealType, setMealType] = useState('Breakfast')
  const [customName, setCustomName] = useState('')
  const [customCals, setCustomCals] = useState('')
  const [showFavsOnly, setShowFavsOnly] = useState(false)
  const [staged, setStaged] = useState<any>(null) // {name, calories, food_id}
  const [mealTime, setMealTime] = useState('')
  const [trackCalories, setTrackCalories] = useState(true)
  const [visibility, setVisibility] = useState<'private'|'family'>('private')
  const [recurrence, setRecurrence] = useState('none')
  const [recurDays, setRecurDays] = useState<number[]>([])
  const [recurEnd, setRecurEnd] = useState('')
  const [placeholderMode, setPlaceholderMode] = useState(false)
  const [placeholderLabel, setPlaceholderLabel] = useState('')

  // month data for calendar + stats
  const [monthMeals, setMonthMeals] = useState<any[]>([])
  const [calMonth, setCalMonth] = useState(new Date())
  const [calView, setCalView] = useState<'month'|'week'>('month')
  const [statPeriod, setStatPeriod] = useState<'today'|'week'|'month'>('week')

  // edit / fill-in
  const [editing, setEditing] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>(null)

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
    const fid = await getFamilyId(); setFamilyId(fid)
    const [{ data: f }, { data: m }, { data: w }, { data: fav }] = await Promise.all([
      supabase.from('food_library').select('*').order('name'),
      supabase.from('planned_meals').select('*').or(`user_id.eq.${userId},and(visibility.eq.family)`).eq('planned_date', date),
      supabase.from('planned_workouts').select('*').eq('user_id', userId).eq('scheduled_date', date),
      supabase.from('favorites').select('item_id').eq('user_id', userId).eq('item_type', 'food'),
    ])
    setFoods(f ?? [])
    setMeals((m ?? []).filter((x:any) => x.user_id === userId || x.visibility === 'family'))
    setWorkouts(w ?? [])
    setFavorites((fav ?? []).map((x: any) => x.item_id))
  }
  useEffect(() => { load() }, [date])

  const loadRange = async () => {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return
    const userId = sess.session.user.id
    const y = calMonth.getFullYear(), m = calMonth.getMonth()
    const start = fmtLocal(new Date(y, m-1, 1))
    const end = fmtLocal(new Date(y, m+2, 0))
    const { data } = await supabase.from('planned_meals').select('*').or(`user_id.eq.${userId},and(visibility.eq.family)`).gte('planned_date', start).lte('planned_date', end)
    setMonthMeals((data ?? []).filter((x:any) => x.user_id === userId || x.visibility === 'family'))
  }
  useEffect(() => { loadRange() }, [calMonth, date])

  const toggleFav = async (foodId: string, e: any) => {
    e.stopPropagation()
    if (favorites.includes(foodId)) await supabase.from('favorites').delete().eq('user_id', uid).eq('item_type', 'food').eq('item_id', foodId)
    else await supabase.from('favorites').insert({ user_id: uid, family_id: familyId, item_type: 'food', item_id: foodId })
    load()
  }
  const toggleDay = (d: number) => setRecurDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])
  const fmt = (d: Date) => fmtLocal(d)

  const buildDates = (startDate: string): string[] => {
    if (recurrence === 'none') return [startDate]
    const dates: string[] = []
    const start = new Date(startDate + 'T00:00:00')
    const end = recurEnd ? new Date(recurEnd + 'T00:00:00') : new Date(start.getTime() + 90*24*60*60*1000)
    let cursor = new Date(start); let iter = 0
    while (cursor <= end && iter < 500) {
      iter++
      const dow = cursor.getDay()
      const ds = fmt(cursor)
      const days = Math.round((cursor.getTime() - start.getTime())/(24*60*60*1000))
      if (recurrence === 'daily') dates.push(ds)
      else if (recurrence === 'weekly') { if (dow === start.getDay()) dates.push(ds) }
      else if (recurrence === 'every_other_week') { if (dow === start.getDay() && Math.floor(days/7)%2===0) dates.push(ds) }
      else if (recurrence === 'custom_days') { if (recurDays.includes(dow)) dates.push(ds) }
      cursor.setDate(cursor.getDate()+1)
    }
    return dates
  }

  const resetAdd = () => {
    setShowAdd(false); setSearch(''); setCustomName(''); setCustomCals(''); setStaged(null)
    setMealTime(''); setTrackCalories(true); setVisibility('private'); setRecurrence('none')
    setRecurDays([]); setRecurEnd(''); setPlaceholderMode(false); setPlaceholderLabel('')
  }

  const saveMeal = async () => {
    // Determine name/calories from staged food, custom, or placeholder
    let name = '', cals: number | null = null, foodId: string | null = null
    if (placeholderMode) {
      name = placeholderLabel || mealType
    } else if (staged) {
      name = staged.name; cals = trackCalories ? staged.calories : null; foodId = staged.food_id
    } else if (customName) {
      name = customName; cals = (trackCalories && customCals) ? parseInt(customCals) : null
    } else { alert('Pick a food or enter a custom meal.'); return }

    const dates = buildDates(date)
    const sid = dates.length > 1 ? uuid() : null
    const rows = dates.map(d => ({
      family_id: familyId, user_id: uid, food_id: foodId,
      custom_name: name, calories: cals, meal_type: mealType, planned_date: d,
      meal_time: mealTime || null, visibility, track_calories: trackCalories,
      recurrence, recurrence_days: recurrence === 'custom_days' ? recurDays : null,
      recurrence_end: recurEnd || null, series_id: sid, is_placeholder: placeholderMode,
    }))
    await supabase.from('planned_meals').insert(rows)
    resetAdd(); load(); loadRange()
  }

  const removeMeal = async (m: any) => {
    if (m.series_id && confirm('Delete this and all future repeats? Cancel = just this one.')) {
      await supabase.from('planned_meals').delete().eq('series_id', m.series_id).gte('planned_date', m.planned_date)
    } else {
      await supabase.from('planned_meals').delete().eq('id', m.id)
    }
    setEditing(null); load(); loadRange()
  }

  const openEdit = (m: any) => {
    setEditing(m)
    setEditForm({ custom_name: m.custom_name, calories: m.calories != null ? String(m.calories) : '', meal_type: m.meal_type, meal_time: m.meal_time ?? '', planned_date: m.planned_date, track_calories: m.track_calories !== false, visibility: m.visibility ?? 'private' })
  }
  const saveEdit = async () => {
    await supabase.from('planned_meals').update({
      custom_name: editForm.custom_name,
      calories: editForm.track_calories && editForm.calories ? parseInt(editForm.calories) : null,
      meal_type: editForm.meal_type, meal_time: editForm.meal_time || null,
      planned_date: editForm.planned_date, track_calories: editForm.track_calories,
      visibility: editForm.visibility, is_placeholder: false,
    }).eq('id', editing.id)
    setEditing(null); setEditForm(null); load(); loadRange()
  }

  const consumed = meals.filter(m => m.track_calories !== false && m.calories).reduce((s, m) => s + m.calories, 0)
  const burned = workouts.filter(w => w.completed).reduce((s, w) => s + (w.calories ?? 0), 0)
  const net = consumed - burned

  let displayFoods = foods
  if (showFavsOnly) displayFoods = foods.filter(f => favorites.includes(f.id))
  if (search) displayFoods = displayFoods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
  displayFoods = [...displayFoods].sort((a, b) => (favorites.includes(a.id)?0:1) - (favorites.includes(b.id)?0:1))

  const mealsForCal = (ds: string) => monthMeals.filter(m => m.planned_date === ds).sort((a,b) => {
    const order = (x:any) => MEAL_TYPES.indexOf(x.meal_type)
    return (a.meal_time||'').localeCompare(b.meal_time||'') || order(a)-order(b)
  })

  // ---- STATS ----
  const periodRange = () => {
    const now = new Date()
    if (statPeriod === 'today') { const s = new Date(now); s.setHours(0,0,0,0); const e = new Date(now); e.setHours(23,59,59,999); return { start:s, end:e, daysTotal:1 } }
    if (statPeriod === 'week') { const s = new Date(now); s.setDate(now.getDate()-now.getDay()); s.setHours(0,0,0,0); const e = new Date(s); e.setDate(s.getDate()+6); e.setHours(23,59,59,999); return { start:s, end:e, daysTotal:7 } }
    const s = new Date(now.getFullYear(), now.getMonth(), 1); const e = new Date(now.getFullYear(), now.getMonth()+1, 0); e.setHours(23,59,59,999); return { start:s, end:e, daysTotal:e.getDate() }
  }
  const statsData = () => {
    const { start, end, daysTotal } = periodRange()
    const inRange = (ds: string) => { const d = new Date(ds+'T12:00:00'); return d>=start && d<=end }
    const ml = monthMeals.filter(m => inRange(m.planned_date) && m.track_calories !== false && m.calories)
    const consumedP = ml.reduce((s,m)=>s+(m.calories??0),0)
    const now = new Date(); const msDay = 24*60*60*1000
    const daysElapsed = Math.min(daysTotal, Math.max(1, Math.floor((now.getTime()-start.getTime())/msDay)+1))
    const proj = Math.round(consumedP / daysElapsed * daysTotal)
    const avg = Math.round(consumedP / daysElapsed)
    return { consumedP, proj, avg, daysElapsed, daysTotal }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Nutrition</h1>
        {section==='today' && <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />}
      </div>

      <div className="flex bg-[#1E293B] rounded-lg p-1 mb-6 border border-[#334155]">
        {(['today','calendar','stats'] as const).map(s => (
          <button key={s} onClick={() => setSection(s)} className={`flex-1 py-2 rounded-md text-xs font-semibold ${section===s?'bg-[#6366F1] text-white':'text-[#64748B]'}`}>{s==='today'?'Today':s==='calendar'?'Calendar':'Stats'}</button>
        ))}
      </div>

      {section!=='stats' && (
        <div className="mb-6">
          <button onClick={() => setShowAdd(!showAdd)} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-bold px-4 py-2.5 rounded-xl">+ Plan a Meal</button>
          {showAdd && section==='calendar' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-[#94A3B8]">Planning for</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-[#1E293B] border border-[#334155] rounded-lg px-3 py-1.5 text-[#F1F5F9] text-sm" />
            </div>
          )}
                  {showAdd && (
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-6 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {MEAL_TYPES.map(t => (
                <button key={t} onClick={() => setMealType(t)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${mealType === t ? 'text-white' : 'bg-[#0F172A] text-[#94A3B8]'}`} style={mealType===t?{backgroundColor:MEAL_COLOR[t]}:{}}>{t}</button>
              ))}
            </div>

            {/* options */}
            <div className="space-y-3 border border-[#334155] rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#94A3B8] w-20">Time</span>
                <select value={mealTime} onChange={e => setMealTime(e.target.value)} className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-1.5 text-[#F1F5F9] text-sm">
                  <option value="">No set time</option>
                  {TIME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#94A3B8] w-20">Repeat</span>
                <select value={recurrence} onChange={e => setRecurrence(e.target.value)} className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-1.5 text-[#F1F5F9] text-sm">
                  <option value="none">Doesn't repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly (same weekday)</option>
                  <option value="every_other_week">Every other week</option>
                  <option value="custom_days">Specific days of week</option>
                </select>
              </div>
              {recurrence==='custom_days' && (
                <div className="flex gap-1 flex-wrap">
                  {WEEKDAYS.map((d,i) => <button key={i} onClick={()=>toggleDay(i)} className={`w-9 h-9 rounded-full text-xs font-semibold ${recurDays.includes(i)?'bg-[#6366F1] text-white':'bg-[#0F172A] text-[#64748B]'}`}>{d[0]}</button>)}
                </div>
              )}
              {recurrence!=='none' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#94A3B8] w-20">Until</span>
                  <input type="date" value={recurEnd} onChange={e=>setRecurEnd(e.target.value)} className="bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-1.5 text-[#F1F5F9] text-sm" />
                  <span className="text-xs text-[#475569]">(blank = 90 days)</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#94A3B8] w-20">Visible to</span>
                <div className="flex gap-2 flex-1">
                  <button onClick={()=>setVisibility('private')} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${visibility==='private'?'bg-[#6366F1] text-white':'bg-[#0F172A] text-[#64748B]'}`}>🔒 Just me</button>
                  <button onClick={()=>setVisibility('family')} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${visibility==='family'?'bg-[#6366F1] text-white':'bg-[#0F172A] text-[#64748B]'}`}>👨‍👩‍👧 Family</button>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!trackCalories} onChange={e => setTrackCalories(!e.target.checked)} className="w-4 h-4 accent-[#6366F1]" />
                <span className="text-sm text-[#F1F5F9]">Just the meal, don't track calories</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={placeholderMode} onChange={e => setPlaceholderMode(e.target.checked)} className="w-4 h-4 accent-[#6366F1]" />
                <span className="text-sm text-[#F1F5F9]">Plan an empty slot, fill in the food later</span>
              </label>
            </div>

            {placeholderMode ? (
              <div className="space-y-2">
                <input value={placeholderLabel} onChange={e=>setPlaceholderLabel(e.target.value)} placeholder={`Label (e.g. "${mealType}")`} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm" />
                <button onClick={saveMeal} className="w-full bg-[#6366F1] text-white text-sm font-bold py-2.5 rounded-lg">Plan {recurrence!=='none'?'recurring ':''}slot</button>
              </div>
            ) : (
              <>
                {staged && (
                  <div className="flex items-center justify-between bg-[#312E81] rounded-lg px-3 py-2">
                    <span className="text-sm text-[#F1F5F9]">Selected: <span className="font-bold">{staged.name}</span>{trackCalories && staged.calories ? ` · ${staged.calories} cal` : ''}</span>
                    <button onClick={()=>setStaged(null)} className="text-[#A5B4FC] text-xs">change</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search foods..." className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
                  <button onClick={() => setShowFavsOnly(!showFavsOnly)} className={`px-3 rounded-lg text-sm font-semibold ${showFavsOnly ? 'bg-[#F59E0B] text-white' : 'bg-[#0F172A] text-[#94A3B8]'}`}>★</button>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 border border-[#334155] rounded-lg p-2">
                  {displayFoods.map(f => (
                    <div key={f.id} className="flex items-center gap-2">
                      <button onClick={(e) => toggleFav(f.id, e)} className="text-lg px-1">{favorites.includes(f.id) ? '⭐' : '☆'}</button>
                      <button onClick={() => setStaged({ name: f.name, calories: f.calories, food_id: f.id })} className={`flex-1 flex justify-between items-center rounded-lg px-3 py-2 text-left border ${staged?.food_id===f.id?'bg-[#312E81] border-[#6366F1]':'bg-[#0F172A] border-transparent hover:bg-[#0A0F1E]'}`}>
                        <div><div className="text-sm text-[#F1F5F9]">{f.name}</div><div className="text-xs text-[#475569]">{f.serving}</div></div>
                        <span className="text-sm font-bold text-[#10B981]">{f.calories} cal</span>
                      </button>
                    </div>
                  ))}
                  {displayFoods.length === 0 && <div className="text-center text-[#475569] text-sm py-4 italic">No foods match</div>}
                </div>
                <div className="border-t border-[#334155] pt-3">
                  <div className="text-xs text-[#64748B] uppercase font-semibold mb-2">Or custom</div>
                  <div className="flex gap-2">
                    <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Meal name" className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm" />
                    {trackCalories && <input value={customCals} onChange={e => setCustomCals(e.target.value)} placeholder="Cals" type="number" className="w-20 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm" />}
                  </div>
                </div>
                <button onClick={saveMeal} className="w-full bg-[#6366F1] text-white text-sm font-bold py-2.5 rounded-lg">{recurrence!=='none'?'Plan recurring meal':'Add to plan'}</button>
              </>
            )}
          </div>
        )}
        </div>
      )}

      {section==='today' && (<>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#1E293B] rounded-2xl p-4 border-l-4 border-[#10B981]">
            <div className="text-xs text-[#64748B] uppercase font-semibold">Consumed</div>
            <div className="text-2xl font-black text-[#10B981] mt-1">{consumed}</div>
          </div>
          <div className="bg-[#1E293B] rounded-2xl p-4 border-l-4 border-[#F59E0B]">
            <div className="text-xs text-[#64748B] uppercase font-semibold">Burned</div>
            <div className="text-2xl font-black text-[#F59E0B] mt-1">{burned}</div>
          </div>
          <div className="bg-[#1E293B] rounded-2xl p-4 border-l-4" style={{ borderColor: net > 0 ? '#6366F1' : '#10B981' }}>
            <div className="text-xs text-[#64748B] uppercase font-semibold">Net</div>
            <div className="text-2xl font-black mt-1" style={{ color: net > 0 ? '#6366F1' : '#10B981' }}>{net > 0 ? '+' : ''}{net}</div>
          </div>
        </div>

        {MEAL_TYPES.map(type => {
          const typeMeals = meals.filter(m => m.meal_type === type).sort((a,b)=>(a.meal_time||'').localeCompare(b.meal_time||''))
          if (typeMeals.length === 0) return null
          const typeCals = typeMeals.filter(m=>m.track_calories!==false&&m.calories).reduce((s, m) => s + m.calories, 0)
          return (
            <div key={type} className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{color:MEAL_COLOR[type]}}>{type}{typeCals>0?` · ${typeCals} cal`:''}</div>
              <div className="space-y-2">
                {typeMeals.map(m => (
                  <button key={m.id} onClick={()=>openEdit(m)} className="w-full bg-[#1E293B] border border-[#334155] rounded-xl p-3 flex items-center justify-between text-left hover:border-[#6366F1]">
                    <div>
                      <span className="text-sm text-[#F1F5F9]">{m.is_placeholder ? `📝 ${m.custom_name} (tap to fill in)` : m.custom_name}</span>
                      <div className="text-xs text-[#475569]">{m.meal_time ? timeLabel(m.meal_time) : ''}{m.visibility==='family'?' · 👨‍👩‍👧':''}{m.series_id?' · 🔁':''}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {m.track_calories!==false && m.calories != null && <span className="text-sm font-bold text-[#10B981]">{m.calories} cal</span>}
                      <span onClick={(e)=>{e.stopPropagation();removeMeal(m)}} className="text-[#64748B] hover:text-red-400 text-sm">✕</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        {meals.length === 0 && <div className="text-center text-[#475569] italic py-12">No meals planned for this day</div>}
      </>)}

      {section==='calendar' && (
        <MealCalendar calMonth={calMonth} setCalMonth={setCalMonth} calView={calView} setCalView={setCalView} mealsForCal={mealsForCal} onPick={openEdit} mealColor={MEAL_COLOR} />
      )}

      {section==='stats' && (() => {
        const s = statsData()
        return (
          <div className="space-y-5">
            <div className="flex bg-[#1E293B] rounded-lg p-1 border border-[#334155] w-fit">
              {(['today','week','month'] as const).map(p => (
                <button key={p} onClick={() => setStatPeriod(p)} className={`px-4 py-1.5 rounded-md text-xs font-semibold ${statPeriod===p?'bg-[#6366F1] text-white':'text-[#64748B]'}`}>{p==='today'?'Today':'This '+p}</button>
              ))}
            </div>
            <div>
              <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Planned so far ({s.daysElapsed} of {s.daysTotal} day{s.daysTotal>1?'s':''})</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1E293B] rounded-2xl p-4 border-l-4 border-[#10B981]">
                  <div className="text-xs text-[#64748B] uppercase font-semibold">Consumed</div>
                  <div className="text-2xl font-black text-[#10B981] mt-1">{s.consumedP}</div>
                </div>
                <div className="bg-[#1E293B] rounded-2xl p-4 border-l-4 border-[#6366F1]">
                  <div className="text-xs text-[#64748B] uppercase font-semibold">Avg / day</div>
                  <div className="text-2xl font-black text-[#6366F1] mt-1">{s.avg}</div>
                </div>
              </div>
            </div>
            {statPeriod!=='today' && (
              <div>
                <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Projected full {statPeriod} (at current pace)</div>
                <div className="bg-[#1E293B]/60 rounded-2xl p-4 border-l-4 border-[#10B981]/50">
                  <div className="text-xs text-[#64748B] uppercase font-semibold">Consumed</div>
                  <div className="text-2xl font-black text-[#10B981] mt-1">{s.proj}</div>
                </div>
              </div>
            )}
            <div className="bg-[#1E1B4B]/30 border border-[#6366F1]/30 rounded-xl p-4 text-sm text-[#A5B4FC]">
              {statPeriod==='today'
                ? <>You've planned <span className="font-bold">{s.consumedP} cal</span> for today.</>
                : <>You're averaging <span className="font-bold">{s.avg} cal/day</span>, trending toward <span className="font-bold">{s.proj} cal</span> for the {statPeriod}.</>}
            </div>
          </div>
        )
      })()}

      {/* Edit / fill-in modal */}
      {editing && editForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setEditing(null); setEditForm(null) }}>
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#F1F5F9] mb-4">{editing.is_placeholder ? 'Fill in this meal' : 'Edit meal'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Meal</label>
                <input value={editForm.custom_name} onChange={e => setEditForm((p:any)=>({...p,custom_name:e.target.value}))} placeholder="What are you eating?" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {MEAL_TYPES.map(t => <button key={t} onClick={()=>setEditForm((p:any)=>({...p,meal_type:t}))} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${editForm.meal_type===t?'text-white':'bg-[#0F172A] text-[#94A3B8]'}`} style={editForm.meal_type===t?{backgroundColor:MEAL_COLOR[t]}:{}}>{t}</button>)}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-[#94A3B8] block mb-1">Date</label>
                  <input type="date" value={editForm.planned_date} onChange={e => setEditForm((p:any)=>({...p,planned_date:e.target.value}))} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[#94A3B8] block mb-1">Time</label>
                  <select value={editForm.meal_time} onChange={e => setEditForm((p:any)=>({...p,meal_time:e.target.value}))} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm">
                    <option value="">No set time</option>
                    {TIME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!editForm.track_calories} onChange={e => setEditForm((p:any)=>({...p,track_calories:!e.target.checked}))} className="w-4 h-4 accent-[#6366F1]" />
                <span className="text-sm text-[#F1F5F9]">Just the meal, don't track calories</span>
              </label>
              {editForm.track_calories && (
                <div>
                  <label className="text-xs text-[#94A3B8] block mb-1">Calories</label>
                  <input type="number" value={editForm.calories} onChange={e => setEditForm((p:any)=>({...p,calories:e.target.value}))} className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm" />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={()=>setEditForm((p:any)=>({...p,visibility:'private'}))} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${editForm.visibility==='private'?'bg-[#6366F1] text-white':'bg-[#0F172A] text-[#64748B]'}`}>🔒 Just me</button>
                <button onClick={()=>setEditForm((p:any)=>({...p,visibility:'family'}))} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${editForm.visibility==='family'?'bg-[#6366F1] text-white':'bg-[#0F172A] text-[#64748B]'}`}>👨‍👩‍👧 Family</button>
              </div>
            </div>
            {editing.series_id && <p className="text-xs text-[#F59E0B] mt-3">🔁 Part of a repeating series. Edits apply to this one.</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={saveEdit} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg">Save</button>
              <button onClick={() => removeMeal(editing)} className="bg-[#1E293B] border border-red-500/40 text-red-400 text-sm font-bold px-4 py-2 rounded-lg">Delete</button>
              <button onClick={() => { setEditing(null); setEditForm(null) }} className="text-[#64748B] text-sm px-4 py-2 rounded-lg ml-auto">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MealCalendar({ calMonth, setCalMonth, calView, setCalView, mealsForCal, onPick, mealColor }: any) {
  const y = calMonth.getFullYear(), m = calMonth.getMonth()
  const todayStr = fmtLocal(new Date())
  let cells: Date[] = []
  if (calView === 'week') {
    const start = new Date(calMonth); start.setDate(calMonth.getDate() - calMonth.getDay())
    cells = Array.from({length:7}, (_,i) => { const d = new Date(start); d.setDate(start.getDate()+i); return d })
  } else {
    const first = new Date(y, m, 1); const pad = first.getDay()
    const total = new Date(y, m+1, 0).getDate()
    const gridStart = new Date(first); gridStart.setDate(1 - pad)
    const totalCells = Math.ceil((pad + total)/7)*7
    cells = Array.from({length: totalCells}, (_,i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate()+i); return d })
  }
  const move = (dir: number) => {
    if (calView === 'week') { const d = new Date(calMonth); d.setDate(calMonth.getDate()+dir*7); setCalMonth(d) }
    else setCalMonth(new Date(y, m+dir, 1))
  }
  const label = calView==='week' ? `${MONTHS[cells[0].getMonth()].slice(0,3)} ${cells[0].getDate()} – ${MONTHS[cells[6].getMonth()].slice(0,3)} ${cells[6].getDate()}` : `${MONTHS[m]} ${y}`

  return (
    <div>
      <div className="flex justify-end mb-3">
        <div className="flex bg-[#1E293B] rounded-lg p-1 border border-[#334155]">
          {(['month','week'] as const).map(v => <button key={v} onClick={()=>setCalView(v)} className={`px-4 py-1.5 rounded-md text-xs font-semibold ${calView===v?'bg-[#6366F1] text-white':'text-[#64748B]'}`}>{v.charAt(0).toUpperCase()+v.slice(1)}</button>)}
        </div>
      </div>
      <div className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#334155]">
          <button onClick={() => move(-1)} className="text-2xl text-[#6366F1] px-3 hover:bg-[#0F172A] rounded-lg">‹</button>
          <span className="font-bold text-[#F1F5F9]">{label}</span>
          <button onClick={() => move(1)} className="text-2xl text-[#6366F1] px-3 hover:bg-[#0F172A] rounded-lg">›</button>
        </div>
        <div className="grid grid-cols-7 border-b border-[#334155]">
          {WEEKDAYS.map(d => <div key={d} className="text-center text-xs text-[#64748B] py-2 font-semibold">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const ds = fmtLocal(d)
            const dayMeals = mealsForCal(ds)
            const dim = calView==='month' && d.getMonth() !== m
            const isToday = ds === todayStr
            const maxBars = calView==='week' ? 8 : 4
            return (
              <div key={i} className={`${calView==='week'?'min-h-[150px]':'min-h-[88px]'} p-1 flex flex-col border border-[#334155]/30`}>
                <span className={`text-xs font-semibold px-1 ${isToday ? 'text-white bg-[#10B981] rounded-full w-5 h-5 flex items-center justify-center' : dim ? 'text-[#475569]' : 'text-[#94A3B8]'}`}>{d.getDate()}</span>
                <div className="flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                  {dayMeals.slice(0,maxBars).map((m: any) => (
                    <button key={m.id} onClick={() => onPick(m)} className="rounded px-1 py-0.5 text-[9px] leading-tight font-medium text-white truncate text-left" style={{backgroundColor: mealColor[m.meal_type] ?? '#64748B'}} title={m.custom_name}>
                      {m.meal_type.slice(0,2)}: {m.is_placeholder ? '—' : m.custom_name}
                    </button>
                  ))}
                  {dayMeals.length > maxBars && <div className="text-[9px] text-[#64748B] px-1">+{dayMeals.length-maxBars}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
