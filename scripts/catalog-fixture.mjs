import assert from 'node:assert/strict'
import { randomInt, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { assertTestEnvironment } from './test-environment.mjs'

export async function createCatalogFixture(count = 240) {
  await assertTestEnvironment()
  assert(Number.isInteger(count) && count > 20 && count <= 1000)
  const label = 'catalog_' + randomUUID().replaceAll('-', ''), start = 2000000000000 + randomInt(100000000) * 1000
  const sql = query => {
    const result = spawnSync('docker', ['compose', 'exec', '-T', 'mysql', 'sh', '-c', 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --default-character-set=utf8mb4 --batch --skip-column-names'], { input: query, encoding: 'utf8', windowsHide: true })
    assert.equal(result.status, 0, 'Verified Test catalog fixture query failed'); return result.stdout.trim()
  }
  const tables = [['pms_brand', 'brand_id', 'name'], ['pms_attr_group', 'attr_group_id', 'attr_group_name'], ['pms_attr', 'attr_id', 'attr_name']]
  for (const [table, id] of tables) assert.equal(sql(`SELECT COUNT(*) FROM gulimall_pms_test.${table} WHERE ${id} BETWEEN ${start} AND ${start + count - 1};`), '0')
  const rows = Array.from({ length: count }, (_, i) => ({ id: start + i, name: label + '_' + String(i).padStart(4, '0'), state: i % 2 }))
  sql(`START TRANSACTION;
    INSERT INTO gulimall_pms_test.pms_brand(brand_id,name,logo,show_status,first_letter,sort) VALUES ${rows.map(r => `(${r.id},'${r.name}','/demo-product.svg',${r.state},'C',0)`).join(',')};
    INSERT INTO gulimall_pms_test.pms_attr_group(attr_group_id,attr_group_name,catelog_id,sort) VALUES ${rows.map(r => `(${r.id},'${r.name}',900003,0)`).join(',')};
    INSERT INTO gulimall_pms_test.pms_attr(attr_id,attr_name,catelog_id,attr_type,enable,search_type,value_type,show_desc) VALUES ${rows.map(r => `(${r.id},'${r.name}',900003,${r.state},${r.state},0,0,1)`).join(',')};
    COMMIT;`)
  return { label, start, count, rows, sql, remove() {
    for (const [table, id, name] of tables) assert.equal(sql(`SELECT COUNT(*) FROM gulimall_pms_test.${table} WHERE ${id} BETWEEN ${start} AND ${start + count - 1} AND BINARY LEFT(${name},${label.length}) <> '${label}';`), '0', 'Fixture ownership changed')
    sql(tables.slice().reverse().map(([table, id]) => `DELETE FROM gulimall_pms_test.${table} WHERE ${id} BETWEEN ${start} AND ${start + count - 1};`).join('\n'))
  } }
}
