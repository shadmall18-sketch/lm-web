'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const TODAY = new Date().toISOString().split('T')[0]

export default function FitnessPage() {
  const supabase = createClient()
  const [uid, setUid] = useState('')
  const [familyId, setFamilyId] = useState('')
  const [exercises, setExercises] = useState<any[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [planned, setPlanned] = useState<any[]>([])
  const [meals, setMeals] = useState<any[]>([])
  const [date, setDate] = useState(TODAY)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [customName, setCustomName] = useState('')
  const [customCals, setCustomCals] = useState('')
  const [showFavsOnly, setShowFavsOnly] = useState(false)
  const [pendingExercise, setPendingExercise] = useState<any>(null)

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

    const [{ data: e }, { data: p }, { data: m }, { data: fav }] = await Promise.all([
      supabase.from('exercise_library').select('*').order('category').order('name'),
      supabase.from('planned_workouts').select('*').eq('user_id', userId).eq('scheduled_date', date),
      supabase.from('planned_meals').select('*').eq('user_id', userId).eq('planned_date', date),
      supabase.from('favorites').select('item_id').eq('user_id', userId).eq('item_type', 'exercise'),
    ])
    setExercises(e ?? [])
    setPlanned(p ?? [])
    setMeals(m ?? [])
    setFavorites((fav ?? []).map((x: any) => x.item_id))
  }

  useEffect(() => { load() }, [date])

  const toggleFav = async (exId: string, e: any) => {
    e.stopPropagation()
    if (favorites.includes(exId)) {
      await supabase.from('favorites').delete().eq('user_id', uid).eq('item_type', 'exercise').eq('item_id', exId)
    } else {
      await supabase.from('favorites').insert({ user_id: uid, family_id: familyId, item_type: 'exercise', item_id: exId })
    }
    load()
  }

  // When picking an exercise, ask visibility first
  const pickExercise = (ex: any) => {
    setPendingExercise({ name: ex.name, calories: ex.calories_est, exercise_id: ex.id })
  }

  const confirmAdd = async (visibility: 'private' | 'family') => {
    const ex = pendingExercise
    await supabase.from('planned_workouts').insert({
      family_id: familyId, user_id: uid,
      exercise_id: ex.exercise_id ?? null,
      custom_name: ex.name, calories: ex.calories,
      scheduled_date: date, visibility, show_on_calendar: true,
    })
    setPendingExercise(null); setShowAdd(false); setSearch(''); load()
  }

  const pickCustom = () => {
    if (!customName || !customCals) return
    setPendingExercise({ name: customName, calories: parseInt(customCals), exercise_id: null })
  }

  const toggleComplete = async (w: any) => {
    await supabase.from('planned_workouts').update({
      completed: !w.completed,
      completed_at: !w.completed ? new Date().toISOString() : null,
    }).eq('id', w.id)
    load()
  }

  const removeWorkout = async (id: string) => {
    await supabase.from('planned_workouts').delete().eq('id', id)
    load()
  }

  const burned = planned.filter(w => w.completed).reduce((s, w) => s + (w.calories ?? 0), 0)
  const consumed = meals.reduce((s, m) => s + m.calories, 0)
  const net = consumed - burned

  let displayEx = exercises
  if (showFavsOnly) displayEx = exercises.filter(e => favorites.includes(e.id))
  if (search) displayEx = displayEx.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
  displayEx = [...displayEx].sort((a, b) => (favorites.includes(a.id) ? 0 : 1) - (favorites.includes(b.id) ? 0 : 1))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Fitness</h1>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
      </div>

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
          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search or scroll the list below..." className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
            <button onClick={() => setShowFavsOnly(!showFavsOnly)} className={`px-3 rounded-lg text-sm font-semibold ${showFavsOnly ? 'bg-[#F59E0B] text-white' : 'bg-[#0F172A] text-[#94A3B8]'}`}>★ Favs</button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 border border-[#334155] rounded-lg p-2">
            {displayEx.map(ex => (
              <div key={ex.id} className="flex items-center gap-2">
                <button onClick={(e) => toggleFav(ex.id, e)} className="text-lg px-1">
                  {favorites.includes(ex.id) ? '⭐' : '☆'}
                </button>
                <button onClick={() => pickExercise(ex)} className="flex-1 flex justify-between items-center bg-[#0F172A] hover:bg-[#0A0F1E] rounded-lg px-3 py-2 text-left">
                  <div>
                    <div className="text-sm text-[#F1F5F9]">{ex.name}</div>
                    <div className="text-xs text-[#475569]">{ex.category}</div>
                  </div>
                  <span className="text-sm font-bold text-[#F59E0B]">{ex.calories_est} cal</span>
                </button>
              </div>
            ))}
            {displayEx.length === 0 && <div className="text-center text-[#475569] text-sm py-4 italic">No exercises match</div>}
          </div>

          <div className="border-t border-[#334155] pt-4">
            <div className="text-xs text-[#64748B] uppercase font-semibold mb-2">Or add custom</div>
            <div className="flex gap-2">
              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Workout name" className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              <input value={customCals} onChange={e => setCustomCals(e.target.value)} placeholder="Cals" type="number" className="w-20 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              <button onClick={pickCustom} className="bg-[#6366F1] text-white text-sm font-bold px-4 rounded-lg">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Visibility prompt modal */}
      {pendingExercise && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setPendingExercise(null)}>
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#F1F5F9] mb-1">Add "{pendingExercise.name}"</h3>
            <p className="text-sm text-[#64748B] mb-5">Who can see this on the calendar?</p>
            <div className="space-y-2">
              <button onClick={() => confirmAdd('private')} className="w-full bg-[#0F172A] hover:bg-[#0A0F1E] border border-[#334155] rounded-xl p-3 text-left">
                <div className="font-semibold text-[#F1F5F9] text-sm">🔒 Only me</div>
                <div className="text-xs text-[#64748B]">Private — just on your calendar</div>
              </button>
              <button onClick={() => confirmAdd('family')} className="w-full bg-[#0F172A] hover:bg-[#0A0F1E] border border-[#334155] rounded-xl p-3 text-left">
                <div className="font-semibold text-[#F1F5F9] text-sm">👨‍👩‍👧 Whole family</div>
                <div className="text-xs text-[#64748B]">Visible to everyone in the family</div>
              </button>
            </div>
            <button onClick={() => setPendingExercise(null)} className="w-full mt-3 text-[#64748B] text-sm py-2">Cancel</button>
          </div>
        </div>
      )}

      <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-3">Scheduled — {planned.length} workouts</div>
      <div className="space-y-2">
        {planned.map(w => (
          <div key={w.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => toggleComplete(w)} className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${w.completed ? 'bg-[#10B981] border-[#10B981]' : 'border-[#475569]'}`}>
                {w.completed && <span className="text-white text-xs">✓</span>}
              </button>
              <div>
                <span className={`text-sm font-semibold ${w.completed ? 'text-[#64748B] line-through' : 'text-[#F1F5F9]'}`}>{w.custom_name}</span>
                <span className="text-xs text-[#475569] ml-2">{w.visibility === 'family' ? '👨‍👩‍👧' : '🔒'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-[#F59E0B]">{w.calories} cal</span>
              <button onClick={() => removeWorkout(w.id)} className="text-[#64748B] hover:text-red-400 text-sm">✕</button>
            </div>
          </div>
        ))}
        {planned.length === 0 && <div className="text-center text-[#475569] italic py-8">No workouts scheduled — add one above</div>}
      </div>
    </div>
  )
}
