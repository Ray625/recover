import { validateData, type FitnessData } from './fitness'

export interface PendingWrite {
  baseRevision: number
  data: FitnessData
}
export function validatePendingWrite(value: unknown): PendingWrite | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object') throw new Error('待同步資料格式不正確')
  const pending = value as PendingWrite
  if (!Number.isSafeInteger(pending.baseRevision) || pending.baseRevision < 0)
    throw new Error('待同步版本不正確')
  return { baseRevision: pending.baseRevision, data: validateData(pending.data) }
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    )
  }
  return value
}
// PostgreSQL JSONB may reorder object keys; a text-only JSON comparison is not sufficient.
export function sameFitnessData(a: FitnessData, b: FitnessData): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}
