'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const TODAY = new Date().toISOString().split('T')[0]

export default function FitnessPage() {
  const supabase = createClient()
  const [uid, setUid] = useState('')
  const [familyId, setFamilyId] = useState('')
  const [tab, setTab] = useState<'plan' | 'library'>('plan')
  const [exercises, setExercises] = useState<any[]>([])
  const [planned, setPlanned] = useState<any[]>([])
  const [meals, setMeals] = useState<any[]>([])
  const [date, setDate] = useState(TODAY)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [customName, setCustomName] = useState('')
  const [customCals, setCustomCals] = useState('')

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

    const [{ data: e }, { data: p }, { data: m }] = await Promise.all([
      supabase.from('exercise_library').select('*').order('category').order('name'),
      supabase.from('planned_workouts').select('*').eq('user_id', userId).eq('scheduled_date', date),
      supabase.from('planned_meals').select('*').eq('user_id', userId).eq('planned_date', date),
    ])
    setExercises(e ?? [])
    setPlanned(p ?? [])
    setMeals(m ?? [])
  }

  useEffect(() => { load() }, [date])

  const addExercise = async (ex: any) => {
    await supabase.from('planned_workouts').insert({
      family_id: familyId, user_id: uid, exercise_id: ex.id,
      custom_name: ex.name, calories: ex.calories_est, scheduled_date: date,
    })
    setShowAdd(false); setSearch(''); load()
  }

  const addCustom = async () => {
    if (!customName || !customCals) return
    await supabase.from('planned_workouts').insert({
      family_id: familyId, user_id: uid,
      custom_name: customName, calories: parseInt(customCals), scheduled_date: date,
    })
    setCustomName(''); setCustomCals(''); setShowAdd(false); load()
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

  const categories = [...new Set(exercises.map(e => e.category))]
  const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Fitness</h1>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
      </div>

      {/* Calorie summary */}
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exercise library..." className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <div className="max-h-56 overflow-y-auto space-y-1">
            {(search ? filtered : exercises).map(ex => (
              <button key={ex.id} onClick={() => addExercise(ex)} className="w-full flex justify-between items-center bg-[#0F172A] hover:bg-[#0A0F1E] rounded-lg px-3 py-2 text-left">
                <div>
                  <div className="text-sm text-[#F1F5F9]">{ex.name}</div>
                  <div className="text-xs text-[#475569]">{ex.category}</div>
                </div>
                <span className="text-sm font-bold text-[#F59E0B]">{ex.calories_est} cal</span>
              </button>
            ))}
          </div>
          <div className="border-t border-[#334155] pt-4">
            <div className="text-xs text-[#64748B] uppercase font-semibold mb-2">Or add custom</div>
            <div className="flex gap-2">
              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Workout name" className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              <input value={customCals} onChange={e => setCustomCals(e.target.value)} placeholder="Cals" type="number" className="w-20 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              <button onClick={addCustom} className="bg-[#6366F1] text-white text-sm font-bold px-4 rounded-lg">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Planned workouts */}
      <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-3">Scheduled — {planned.length} workouts</div>
      <div className="space-y-2">
        {planned.map(w => (
          <div key={w.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => toggleComplete(w)} className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${w.completed ? 'bg-[#10B981] border-[#10B981]' : 'border-[#475569]'}`}>
                {w.completed && <span className="text-white text-xs">✓</span>}
              </button>
              <span className={`text-sm font-semibold ${w.completed ? 'text-[#64748B] line-through' : 'text-[#F1F5F9]'}`}>{w.custom_name}</span>
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
