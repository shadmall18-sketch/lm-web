'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function FitnessPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [feed, setFeed] = useState<any[]>([])
  const [goals, setGoals] = useState<any[]>([])
  const [tab, setTab] = useState<'feed'|'goals'>('feed')
  const [showLog, setShowLog] = useState(false)
  const [showGoal, setShowGoal] = useState(false)
  const [wForm, setWForm] = useState({ title:'', workout_type:'Run', duration_mins:'', calories:'', notes:'', is_private: false })
  const [gForm, setGForm] = useState({ title:'', target_value:'', target_unit:'', target_date:'', is_private: false })

  const getFamilyId = async () => {
    const { data: u } = await supabase.auth.getUser()
    const { data } = await supabase.from('users').select('family_id').eq('id', u.user!.id).single()
    return data?.family_id
  }

  const load = async () => {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return
    const { data: profile } = await supabase.from('users').select('*').eq('id', sess.session.user.id).single()
    setUser(profile)
    const [{ data: f }, { data: g }] = await Promise.all([
      supabase.from('workouts').select('*, user:users(display_name)').eq('is_private', false).order('logged_at', { ascending: false }).limit(20),
      supabase.from('fitness_goals').select('*, user:users(display_name)').order('created_at', { ascending: false }),
    ])
    setFeed(f ?? []); setGoals(g ?? [])
  }

  useEffect(() => { load() }, [])

  const handleLog = async () => {
    if (!wForm.title) return
    const { data: u } = await supabase.auth.getUser()
    const fid = await getFamilyId()
    await supabase.from('workouts').insert({ title: wForm.title, workout_type: wForm.workout_type.toLowerCase(), duration_mins: parseInt(wForm.duration_mins)||null, calories: parseInt(wForm.calories)||null, notes: wForm.notes, is_private: wForm.is_private, family_id: fid, user_id: u.user!.id })
    setShowLog(false); setWForm({ title:'', workout_type:'Run', duration_mins:'', calories:'', notes:'', is_private: false }); load()
  }

  const handleAddGoal = async () => {
    if (!gForm.title) return
    const { data: u } = await supabase.auth.getUser()
    const fid = await getFamilyId()
    await supabase.from('fitness_goals').insert({ title: gForm.title, goal_type: 'custom', target_value: parseFloat(gForm.target_value)||null, target_unit: gForm.target_unit, target_date: gForm.target_date||null, is_private: gForm.is_private, status: 'active', family_id: fid, user_id: u.user!.id })
    setShowGoal(false); setGForm({ title:'', target_value:'', target_unit:'', target_date:'', is_private: false }); load()
  }

  const TYPES = ['Run','Walk','Lift','Yoga','Bike','Swim','HIIT','Custom']

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Fitness</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowLog(!showLog)} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#4F46E5]">+ Workout</button>
          <button onClick={() => setShowGoal(!showGoal)} className="bg-[#1E293B] border border-[#334155] text-white text-sm font-bold px-4 py-2 rounded-xl hover:border-[#6366F1]">+ Goal</button>
        </div>
      </div>

      {showLog && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-6 space-y-3">
          <input value={wForm.title} onChange={e => setWForm(p=>({...p,title:e.target.value}))} placeholder="Workout title" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <div className="flex gap-2 flex-wrap">{TYPES.map(t => <button key={t} onClick={() => setWForm(p=>({...p,workout_type:t}))} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${wForm.workout_type===t?'bg-[#6366F1] text-white':'bg-[#0F172A] text-[#94A3B8]'}`}>{t}</button>)}</div>
          <div className="grid grid-cols-2 gap-3">
            <input value={wForm.duration_mins} onChange={e => setWForm(p=>({...p,duration_mins:e.target.value}))} placeholder="Duration (mins)" type="number" className="bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
            <input value={wForm.calories} onChange={e => setWForm(p=>({...p,calories:e.target.value}))} placeholder="Calories" type="number" className="bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#94A3B8] cursor-pointer">
            <input type="checkbox" checked={!wForm.is_private} onChange={e => setWForm(p=>({...p,is_private:!e.target.checked}))} className="accent-[#6366F1]" />
            Share with family
          </label>
          <div className="flex gap-2">
            <button onClick={handleLog} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg">Save</button>
            <button onClick={() => setShowLog(false)} className="text-[#64748B] text-sm px-4 py-2 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {showGoal && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 mb-6 space-y-3">
          <input value={gForm.title} onChange={e => setGForm(p=>({...p,title:e.target.value}))} placeholder="Goal title" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          <div className="grid grid-cols-2 gap-3">
            <input value={gForm.target_value} onChange={e => setGForm(p=>({...p,target_value:e.target.value}))} placeholder="Target (e.g. 5)" type="number" className="bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
            <input value={gForm.target_unit} onChange={e => setGForm(p=>({...p,target_unit:e.target.value}))} placeholder="Unit (miles, lbs...)" className="bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:border-[#6366F1]" />
          </div>
          <input value={gForm.target_date} onChange={e => setGForm(p=>({...p,target_date:e.target.value}))} type="date" className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#6366F1]" />
          <label className="flex items-center gap-2 text-sm text-[#94A3B8] cursor-pointer">
            <input type="checkbox" checked={!gForm.is_private} onChange={e => setGForm(p=>({...p,is_private:!e.target.checked}))} className="accent-[#6366F1]" />
            Share with family
          </label>
          <div className="flex gap-2">
            <button onClick={handleAddGoal} className="bg-[#6366F1] text-white text-sm font-bold px-4 py-2 rounded-lg">Save</button>
            <button onClick={() => setShowGoal(false)} className="text-[#64748B] text-sm px-4 py-2 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex bg-[#1E293B] rounded-xl p-1 mb-6 border border-[#334155]">
        {(['feed','goals'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab===t?'bg-[#6366F1] text-white':'text-[#64748B]'}`}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
      </div>

      {tab==='feed' && (
        <div className="space-y-4">
          {feed.map(w => (
            <div key={w.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-[#6366F1] flex items-center justify-center text-white font-bold">{w.user?.display_name?.[0]}</div>
                <div>
                  <div className="font-semibold text-[#F1F5F9] text-sm">{w.user?.display_name}</div>
                  <div className="text-xs text-[#64748B]">{new Date(w.logged_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="font-bold text-[#F1F5F9] mb-2">{w.title}</div>
              <div className="flex gap-4">
                {w.duration_mins && <span className="text-sm text-[#94A3B8]">⏱ {w.duration_mins} min</span>}
                {w.calories && <span className="text-sm text-[#94A3B8]">🔥 {w.calories} cal</span>}
                {w.workout_type && <span className="text-sm text-[#94A3B8]">💪 {w.workout_type}</span>}
              </div>
            </div>
          ))}
          {feed.length===0 && <div className="text-center text-[#475569] italic py-12">No shared workouts yet</div>}
        </div>
      )}

      {tab==='goals' && (
        <div className="space-y-2">
          {goals.map(g => (
            <div key={g.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#F1F5F9]">{g.title}</div>
                <div className="text-sm text-[#64748B] mt-0.5">{g.user?.display_name} {g.target_value && `· ${g.target_value} ${g.target_unit}`}</div>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${g.status==='completed'?'bg-green-900 text-green-400':'bg-[#1E3A5F] text-[#93C5FD]'}`}>{g.status}</span>
            </div>
          ))}
          {goals.length===0 && <div className="text-center text-[#475569] italic py-12">No goals set yet</div>}
        </div>
      )}
    </div>
  )
}
