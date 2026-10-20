const { adminRest } = require('./firebase-admin-client.cjs');
async function main() {
  const username = process.argv[2];
  if (!/^[a-z0-9_]{4,20}$/.test(username ?? '')) throw new Error('Usage: node scripts/setup-gacha-admin.cjs <login-id>');
  const rows = await adminRest(':runQuery','POST',{structuredQuery:{from:[{collectionId:'users'}],where:{fieldFilter:{field:{fieldPath:'username'},op:'EQUAL',value:{stringValue:username}}},limit:2}});
  const users=rows.filter(r=>r.document);
  if (users.length!==1) throw new Error('해당 아이디의 계정을 하나로 확인하지 못했어요.');
  const uid=users[0].document.name.split('/').at(-1);
  await adminRest(`administrators/${uid}`, 'PATCH', { fields:{ enabled:{ booleanValue:true },username:{ stringValue:username },updatedAt:{ timestampValue:new Date().toISOString() } } });
  console.log(`Administrator enabled for ${username}. No password was used.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
