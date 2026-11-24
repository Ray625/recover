export interface Category {
  id: string
  name: string
  color: string
}
export interface Exercise {
  id: string
  categoryId: string
  name: string
}
export interface WorkoutSet {
  weight: number
  reps: number
}
export interface Workout {
  id: string
  date: string
  exerciseId: string
  exerciseName: string
  categoryName: string
  categoryColor: string
  mode: 'simple' | 'detailed'
  weightMode: 'each' | 'total'
  weight: number
  count: number
  sets: WorkoutSet[]
  completed: boolean
  createdAt: string
  updatedAt: string
}
export interface FitnessData {
  version: 1
  categories: Category[]
  exercises: Exercise[]
  workouts: Workout[]
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00`)
  return !Number.isNaN(date.getTime()) && localDate(date) === value
}
const text = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= 200
const weight = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10000
const count = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 1000
const color = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
export function validateData(value: unknown): FitnessData {
  if (!value || typeof value !== 'object') throw new Error('備份格式不正確')
  const data = value as FitnessData
  if (
    data.version !== 1 ||
    !Array.isArray(data.categories) ||
    !Array.isArray(data.exercises) ||
    !Array.isArray(data.workouts)
  )
    throw new Error('備份版本或格式不正確')
  const ids = new Set<string>()
  const unique = (id: unknown) => {
    if (!text(id) || ids.has(id)) throw new Error('資料識別碼重複或無效')
    ids.add(id)
  }
  for (const c of data.categories) {
    if (!c || !text(c.name) || !color(c.color)) throw new Error('分類資料不正確')
    unique(c.id)
  }
  for (const e of data.exercises) {
    if (!e || !text(e.name) || !data.categories.some((c) => c.id === e.categoryId))
      throw new Error('動作分類不正確')
    unique(e.id)
  }
  for (const w of data.workouts) {
    if (
      !w ||
      !isDate(w.date) ||
      !text(w.exerciseId) ||
      !text(w.exerciseName) ||
      !text(w.categoryName) ||
      !color(w.categoryColor) ||
      !['simple', 'detailed'].includes(w.mode) ||
      !['each', 'total'].includes(w.weightMode) ||
      typeof w.completed !== 'boolean' ||
      !weight(w.weight) ||
      !count(w.count) ||
      !Array.isArray(w.sets) ||
      !text(w.createdAt) ||
      !text(w.updatedAt) ||
      Number.isNaN(Date.parse(w.createdAt)) ||
      Number.isNaN(Date.parse(w.updatedAt))
    )
      throw new Error('訓練紀錄不正確')
    unique(w.id)
    if (w.mode === 'simple' && w.sets.length) throw new Error('簡略紀錄格式不正確')
    if (
      w.mode === 'detailed' &&
      (w.sets.length !== w.count || w.sets.some((s) => !s || !weight(s.weight) || !count(s.reps)))
    )
      throw new Error('逐組資料不正確')
  }
  return data
}
export function initialData(): FitnessData {
  const names = ['胸', '背', '肩', '腿', '手臂', '核心']
  const exercises = ['啞鈴臥推', '滑輪下拉', '啞鈴肩推', '槓鈴深蹲', '啞鈴彎舉', '捲腹']
  const colors = ['#c88c68', '#789485', '#8b8eaf', '#b0a070', '#b4848e', '#7e9ca7']
  return {
    version: 1,
    categories: names.map((name, i) => ({ id: `category-${i}`, name, color: colors[i]! })),
    exercises: exercises.map((name, i) => ({
      id: `exercise-${i}`,
      name,
      categoryId: `category-${i}`,
    })),
    workouts: [],
  }
}
