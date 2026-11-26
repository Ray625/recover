import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import { validateData, type FitnessData } from '@/domain/fitness'

export interface CloudDocument {
  data: FitnessData
  revision: number
}
export class SyncConflict extends Error {}
function parseDocument(value: unknown): CloudDocument {
  if (!value || typeof value !== 'object') throw new Error('雲端資料格式不正確')
  const row = value as CloudDocument
  if (!Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error('雲端資料版本不正確')
  return { data: validateData(row.data), revision: row.revision }
}
export function cloudRepository(accessToken: string, userId: string) {
  // Bind requests to the captured account, even if the UI signs into another account mid-request.
  const client = createClient(supabaseUrl, supabaseKey, { accessToken: async () => accessToken })
  return {
    async load(): Promise<CloudDocument | null> {
      const result = await client
        .from('fitness_documents')
        .select('data,revision')
        .eq('user_id', userId)
        .abortSignal(AbortSignal.timeout(15000))
        .maybeSingle()
        .retry(false)
      if (result.error) throw result.error
      return result.data ? parseDocument(result.data) : null
    },
    async save(data: FitnessData, revision: number): Promise<CloudDocument> {
      const result = await client
        .rpc('save_fitness_document', {
          p_data: data,
          p_expected_revision: revision,
        })
        .abortSignal(AbortSignal.timeout(15000))
        .retry(false)
      if (result.error) {
        if (result.error.code === '40001')
          throw new SyncConflict('雲端已有新版本，請先處理同步衝突')
        throw result.error
      }
      return parseDocument(result.data)
    },
  }
}
