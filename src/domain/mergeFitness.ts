import { validateData, type FitnessData } from './fitness'
import { createId } from '@/utils/id'

export function mergeGuestData(account: FitnessData, guest: FitnessData): FitnessData {
  const result = JSON.parse(JSON.stringify(account)) as FitnessData
  const categories = new Map<string, string>()
  const exercises = new Map<string, string>()
  for (const category of guest.categories) {
    let target = result.categories.find((c) => c.name === category.name)
    if (!target) {
      target = { ...category, id: createId() }
      result.categories.push(target)
    }
    categories.set(category.id, target.id)
  }
  for (const exercise of guest.exercises) {
    const categoryId = categories.get(exercise.categoryId)!
    let target = result.exercises.find(
      (e) => e.categoryId === categoryId && e.name === exercise.name,
    )
    if (!target) {
      target = { ...exercise, categoryId, id: createId() }
      result.exercises.push(target)
    }
    exercises.set(exercise.id, target.id)
  }
  for (const workout of guest.workouts) {
    if (result.workouts.some((w) => w.id === workout.id)) continue
    result.workouts.push({
      ...workout,
      exerciseId: exercises.get(workout.exerciseId) ?? `deleted-${createId()}`,
    })
  }
  return validateData(result)
}
