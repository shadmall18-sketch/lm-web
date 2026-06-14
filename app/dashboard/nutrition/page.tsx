'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const TODAY = new Date().toISOString().split('T')[0]
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

export default function NutritionPage() {
  const supabase = createClient()
  const [uid, setUid] = useState<string>('')
  const [familyId, setFamilyId] = useState<string>('')
  const [foods, setFoods] = useState<any[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [meals, setMeals] = useState<any[]>([])
  const [workouts, setWorkouts] = useState<any[]>([])
  const [date, setDate] = useState(TODAY)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [mealType, setMealType] = useState('Breakfast')
  const [customName, setCustomName] = useState('')
  const [customCals, setCustomCals] = useState('')
  const [showFavsOnly, setShowFavsOnly] = useState(false)

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

    const [{ data: f }, { data: m }, { data: w }, { data: fav }] = await Promise.all([
      supabase.from('food_library').select('*').order('name'),
      supabase.from('planned_meals').select('*').eq('user_id', userId).eq('planned_date', date),
      supabase.from('planned_workouts').select('*').eq('user_id', userId).eq('scheduled_date', date),
      supabase.from('favorites').select('item_id').eq('user_id', userId).eq('item_type', 'food'),
    ])
    setFoods(f ?? [])
    setMeals(m ?? [])
    setWorkouts(w ?? [])
    setFavorites((fav ?? []).map((x: any) => x.item_id))
  }

  useEffect(() => { load() }, [date])

  const toggleFav = async (foodId: string, e: any) => {
    e.stopPropagation()
    if (favorites.includes(foodId)) {
      await supabase.from('favorites').delete().eq('user_id', uid).eq('item_type', 'food').eq('item_id', foodId)
    } else {
      await supabase.from('favorites').insert({ user_id: uid, family_id: familyId, item_type: 'food', item_id: foodId })
    }
    load()
  }

  const addFood = async (food: any) => {
    await supabase.from('planned_meals').insert({
      family_id: familyId, user_id: uid, food_id: food.id,
      custom_name: food.name, calories: food.calories,
      meal_type: mealType, planned_date: date,
    })
    setShowAdd(false); setSearch(''); load()
  }

  const addCustom = async () => {
    if (!customName || !customCals) return
    await supabase.from('planned_meals').insert({
      family_id: familyId, user_id: uid,
      custom_name: customName, calories: parseInt(customCals),
      meal_type: mealType, planned_date: date,
    })
    setCustomName(''); setCustomCals(''); setShowAdd(false); load()
  }

  const removeMeal = async (id: string) => {
    await supabase.from('planned_meals').delete().eq('id', id)
    load()
  }

  const consumed = meals.reduce((s, m) => s + m.calories, 0)
  const burned = workouts.filter(w => w.completed).reduce((s, w) => s + (w.calories ?? 0), 0)
  const net = consumed - burned

  let displayFoods = foods
  if (showFavsOnly) displayFoods = foods.filter(f => favorites.includes(f.id))
  if (search) displayFoods = displayFoods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
  // Sort favorites to top
  displayFoods = [...displayFoods].sort((a, b) => {
    const af = favorites.includes(a.id) ? 0 : 1
    const bf = favorites.includes(b.id) ? 0 : 1
    return af - bf
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Nutrition</h1>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
      </div>

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

      <button onClick={() => setShowAdd(!showAdd)} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-bold px-4 py-2.5 rounded-xl mb-6">+ Add Food</button>

      {showAdd && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-6 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {MEAL_TYPES.map(t => (
              <button key={t} onClick={() => setMealType(t)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${mealType === t ? 'bg-[#6366F1] text-white' : 'bg-[#0F172A] text-[#94A3B8]'}`}>{t}</button>
            ))}
          </div>

          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search or scroll the list below..." className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
            <button onClick={() => setShowFavsOnly(!showFavsOnly)} className={`px-3 rounded-lg text-sm font-semibold ${showFavsOnly ? 'bg-[#F59E0B] text-white' : 'bg-[#0F172A] text-[#94A3B8]'}`}>★ Favs</button>
          </div>

          {/* Scrollable dropdown list — always visible */}
          <div className="max-h-64 overflow-y-auto space-y-1 border border-[#334155] rounded-lg p-2">
            {displayFoods.map(f => (
              <div key={f.id} className="flex items-center gap-2">
                <button onClick={(e) => toggleFav(f.id, e)} className="text-lg px-1">
                  {favorites.includes(f.id) ? '⭐' : '☆'}
                </button>
                <button onClick={() => addFood(f)} className="flex-1 flex justify-between items-center bg-[#0F172A] hover:bg-[#0A0F1E] rounded-lg px-3 py-2 text-left">
                  <div>
                    <div className="text-sm text-[#F1F5F9]">{f.name}</div>
                    <div className="text-xs text-[#475569]">{f.serving}</div>
                  </div>
                  <span className="text-sm font-bold text-[#10B981]">{f.calories} cal</span>
                </button>
              </div>
            ))}
            {displayFoods.length === 0 && <div className="text-center text-[#475569] text-sm py-4 italic">No foods match</div>}
          </div>

          <div className="border-t border-[#334155] pt-4">
            <div className="text-xs text-[#64748B] uppercase font-semibold mb-2">Or add custom</div>
            <div className="flex gap-2">
              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Food name" className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              <input value={customCals} onChange={e => setCustomCals(e.target.value)} placeholder="Cals" type="number" className="w-20 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
              <button onClick={addCustom} className="bg-[#6366F1] text-white text-sm font-bold px-4 rounded-lg">Add</button>
            </div>
          </div>
        </div>
      )}

      {MEAL_TYPES.map(type => {
        const typeMeals = meals.filter(m => m.meal_type === type)
        if (typeMeals.length === 0) return null
        return (
          <div key={type} className="mb-4">
            <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">{type} · {typeMeals.reduce((s, m) => s + m.calories, 0)} cal</div>
            <div className="space-y-2">
              {typeMeals.map(m => (
                <div key={m.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm text-[#F1F5F9]">{m.custom_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[#10B981]">{m.calories} cal</span>
                    <button onClick={() => removeMeal(m.id)} className="text-[#64748B] hover:text-red-400 text-sm">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {meals.length === 0 && <div className="text-center text-[#475569] italic py-12">No meals planned for this day</div>}
    </div>
  )
}
