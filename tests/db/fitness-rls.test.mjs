import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const migration = await readFile(
  new URL('../../supabase/migrations/202611260001_fitness_documents.sql', import.meta.url),
  'utf8',
)
const document = { version: 1, categories: [], exercises: [], workouts: [] }
async function database() {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${A}'), ('${B}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `)
  await db.exec(migration)
  return db
}
async function asUser(db, id) {
  await db.exec('reset role; set role authenticated;')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id])
}
const save = (db, revision, data = document) =>
  db.query('select public.save_fitness_document($1::jsonb, $2::bigint) as doc', [
    JSON.stringify(data),
    revision,
  ])

test('RLS isolates account data and rejects writing another owner', async () => {
  const db = await database()
  try {
    await asUser(db, A)
    await save(db, 0)
    assert.equal((await db.query('select * from public.fitness_documents')).rows.length, 1)
    await asUser(db, B)
    assert.equal((await db.query('select * from public.fitness_documents')).rows.length, 0)
    assert.equal(
      (
        await db.query(
          'update public.fitness_documents set revision = 9 where user_id = $1 returning user_id',
          [A],
        )
      ).rows.length,
      0,
    )
    await assert.rejects(
      db.query('insert into public.fitness_documents(user_id,data) values ($1,$2::jsonb)', [
        A,
        JSON.stringify(document),
      ]),
      { code: '42501' },
    )
    await save(db, 0)
    const own = await db.query('select user_id from public.fitness_documents')
    assert.deepEqual(own.rows, [{ user_id: B }])
    await db.exec('reset role; set role anon;')
    await assert.rejects(db.query('select * from public.fitness_documents'), { code: '42501' })
    await assert.rejects(save(db, 0), { code: '42501' })
  } finally {
    await db.close()
  }
})

test('atomic version check rejects stale writes without overwriting data', async () => {
  const db = await database()
  try {
    await asUser(db, A)
    assert.equal((await save(db, 0)).rows[0].doc.revision, 1)
    await assert.rejects(save(db, 0), { code: '40001' })
    const updated = { ...document, categories: [{ id: 'chest', name: '胸', color: '#c88c68' }] }
    assert.equal((await save(db, 1, updated)).rows[0].doc.revision, 2)
    await assert.rejects(save(db, 1), { code: '40001' })
    assert.deepEqual(
      (await db.query('select data,revision from public.fitness_documents')).rows[0].data,
      updated,
    )
    await assert.rejects(save(db, 2, { version: 1 }), { code: '23514' })
    assert.equal(
      (await db.query('select revision from public.fitness_documents')).rows[0].revision,
      2,
    )
  } finally {
    await db.close()
  }
})
