cd /var/www/wesetupru/data/www/wesetup.ru/app
node - <<'NODE'
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const envPath = path.join(process.cwd(), '.env');
const env = Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
  const i = line.indexOf('=');
  return i === -1 ? [line,''] : [line.slice(0,i), line.slice(i+1)];
}));
const client = new Client({ connectionString: env.DATABASE_URL });
const orgId = 'cmnm40ikt00002ktseet6fd5y';
const day = '2026-04-14';
(async () => {
  await client.connect();
  const sql = `
    select t.code,
           count(e.id)::int as entry_count,
           case when jsonb_typeof(d.config::jsonb) = 'object' then
             jsonb_build_object(
               'rows', case when jsonb_typeof(d.config::jsonb->'rows') = 'array' then jsonb_array_length(d.config::jsonb->'rows') else null end,
               'receipts', case when jsonb_typeof(d.config::jsonb->'receipts') = 'array' then jsonb_array_length(d.config::jsonb->'receipts') else null end,
               'consumptions', case when jsonb_typeof(d.config::jsonb->'consumptions') = 'array' then jsonb_array_length(d.config::jsonb->'consumptions') else null end,
               'items', case when jsonb_typeof(d.config::jsonb->'items') = 'array' then jsonb_array_length(d.config::jsonb->'items') else null end,
               'zones', case when jsonb_typeof(d.config::jsonb->'zones') = 'array' then jsonb_array_length(d.config::jsonb->'zones') else null end
             )
           else null end as cfg
    from "JournalDocument" d
    join "JournalTemplate" t on t.id = d."templateId"
    left join "JournalDocumentEntry" e
      on e."documentId" = d.id and e.date = $2::date
    where d."organizationId" = $1
      and d.status = 'active'
      and d."dateFrom" <= $2::date and d."dateTo" >= $2::date
    group by t.code, d.config
    order by t.code;
  `;
  const res = await client.query(sql, [orgId, day]);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
})();
NODE
