/* 离线协议/Surge API 模拟回归：node test-baidu-netdisk.cjs。不访问网络。 */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'baidu-netdisk.js'),'utf8');
const setup = fs.readFileSync(path.join(__dirname,'baidu-netdisk-config.js'),'utf8');
const CK='BaiduNetdisk.Config.v1', SK='BaiduNetdisk.State.v1', LK='BaiduNetdisk.Lock.v1';
const now = Math.floor(Date.now()/1000);
const digest = s => crypto.createHash('md5').update(s).digest('hex');
const account = extra => Object.assign({id:'one',name:'测试',cookie:'BDUSS=SECRET_ONE; STOKEN=TOKEN_ONE',taskcenter:false},extra);
const app = extra => Object.assign({uid:'123',device:'0123456789ABCDEF0123456789ABCDEF|ABCDEFGH',z:'z'.repeat(87),capturedAt:now,channel:'android_15_V2364A_bd-netdisk_1027840c',ua:'Mozilla/5.0 (Linux; Android 15; V2364A Build/V417IR; wv)',version:'13.34.3',versioncode:'4228',offlinepackage:{'2004':{version:93}}},extra);
function fixture(u) {
  const p=u.pathname, method=u.searchParams.get('method');
  if(p==='/api/loginstatus') return {errno:0,login_info:{uk:'123'}};
  if(p==='/rest/2.0/xpan/nas') return {errno:0,uk:'123'};
  if(p==='/rest/2.0/membership/level') {
    if(method==='signinlist') return {error_code:0,data:{today_signed:0,signed_cnt:2}};
    if(method==='signin') return {error_code:0,result:{points:5}};
    if(method==='config') return {error_code:0,data:{level_infos:{'1':{value:0},'2':{value:1000},'3':{value:3000}}}};
  }
  if(p==='/rest/2.0/membership/user') return {error_code:0,level_info:{current_level:1,current_value:900}};
  if(p.endsWith('/getdailyquestion')) return {errno:0,data:{ask_id:7,answer:0,answer_status:0}};
  if(p.endsWith('/answerquestion')) return {errno:0,data:{score:2}};
  if(p==='/coins/pc/signinlist') return {errno:0,data:{signed_today:0,points_balance:100}};
  if(p==='/coins/pc/signin') return {errno:0};
  if(p==='/') return {raw:'<html>OK</html>'};
  if(p==='/coins/taskcenter/signinlist') return {errno:0,data:{signed_today:0,start_time:100000,date:100000+3*86400,signin_list:[{day:1,signed:0},{day:2,signed:1},{day:3,signed:0},{day:4,signed:0}]}};
  if(p==='/coins/taskcenter/checkdevmp') return {errno:0};
  if(p==='/coins/taskcenter/signin') return {errno:0,data:{signed:0}};
  if(p==='/coins/taskcenter/supptasklist') return {errno:0,data:{supp_type:1}};
  if(p==='/coins/taskcenter/suppsignin') return {errno:0};
  if(p==='/coins/center/home') return {errno:0,data:{signed:0,signin_version:2,coin_balance:100}};
  if(p==='/coins/center/signinv2') return {errno:0};
  throw Error('Unexpected endpoint '+p);
}
async function run(options={}) {
  const store = options.store || new Map();
  if(options.accounts) store.set(CK,JSON.stringify({accounts:options.accounts,...options.config}));
  const calls=[], notifications=[], logs=[], apiCalls=[];
  let done=0, end;
  const completion = new Promise(resolve=>end=resolve);
  const context = {
    $argument:options.mode ? 'mode='+options.mode : 'mode=run',
    $persistentStore:{read:k=>store.get(k)||null,write:(v,k)=>{if(options.failWrite)return false; if(v===null)store.delete(k);else store.set(k,v);return true;}},
    $notification:{post:(...x)=>notifications.push(x)},
    console:{log:s=>logs.push(s)},
    $httpClient:{get:(opts,cb)=>{
      calls.push(opts);
      try {
        const u=new URL(opts.url);
        assert.equal(u.origin,'https://pan.baidu.com');
        assert.equal(opts['auto-cookie'],false);
        assert.equal(opts['auto-redirect'],false);
        const d=options.respond ? options.respond(u,opts,calls) ?? fixture(u) : fixture(u);
        if(d.networkError) return cb('network failure, secret?',null,null);
        cb(null,{status:d.httpStatus||200,headers:d.headers||[]},d.raw === undefined ? JSON.stringify(d) : d.raw);
      } catch(e) { end({harnessError:e}); }
    }},
    $done:()=>{done++;end();}
  };
  if(options.request) context.$request=options.request;
  if(options.intent) context.$intent={parameter:options.intent};
  if(options.api) {
    context.setTimeout=(fn)=>{ if(options.timerFirst) fn(); return 1; };
    context.$httpAPI=(method,path,body,cb)=>{apiCalls.push({method,path,body});if(!options.timerFirst)cb({});else cb({});};
  }
  vm.runInNewContext(options.source||source,context,{timeout:2000});
  const result=await Promise.race([completion,new Promise(resolve=>{const t=setTimeout(()=>resolve({harnessError:Error('No $done')}),1000);t.unref();})]);
  if(result?.harnessError) throw result.harnessError;
  assert.equal(done,1,'$done exactly once');
  const output=JSON.stringify({notifications,logs});
  for(const secret of ['SECRET_ONE','TOKEN_ONE','SECRET_TWO','TOKEN_TWO','REFRESH_SECRET','QUERY_SECRET']) assert(!output.includes(secret),'secret in logs/notifications');
  return {store,calls,notifications,logs,apiCalls,text:output};
}
const paths=r=>r.calls.map(c=>new URL(c.url).pathname);
const mutations=r=>r.calls.filter(c=>{const u=new URL(c.url);return /\/(?:signin|signinv2|answerquestion|suppsignin|checkdevmp)$/.test(u.pathname)||u.searchParams.get('method')==='signin';});
const tests=[];
const test=(name,fn)=>tests.push([name,fn]);
test('no credentials: notify and zero HTTP',async()=>{const r=await run();assert.equal(r.calls.length,0);assert(r.text.includes('尚未获取'));});
test('first App request captures mixed-case Cookie and notifies once',async()=>{
  const request={url:'https://pan.baidu.com/api/loginstatus',headers:{cOoKiE:'BDUSS=SECRET_ONE; STOKEN=TOKEN_ONE; MAWEBCUID=web_123'}};
  const r=await run({mode:'capture',request});assert.equal(r.calls.length,0);assert.equal(r.notifications.length,1);assert.equal(JSON.parse(r.store.get(CK)).accounts[0].id,'captured');
  const again=await run({mode:'capture',request,store:r.store});assert.equal(again.notifications.length,0);
});
test('capture query tokens and update STOKEN',async()=>{
  const r=await run({mode:'capture',request:{url:'https://pan.baidu.com/rest/2.0/xpan/nas?bduss=QUERY_SECRET&stoken=newtoken',headers:{}}});
  assert(JSON.parse(r.store.get(CK)).accounts[0].cookie.includes('BDUSS=QUERY_SECRET'));
  const n=await run({store:r.store,mode:'capture',request:{url:'https://pan.baidu.com/api/loginstatus',headers:{Cookie:'BDUSS=QUERY_SECRET; STOKEN=updated'}}});assert.equal(n.notifications.length,1);
});
test('capture does not mix credentials after App switches accounts',async()=>{
  const store=new Map([[CK,JSON.stringify({accounts:[account({id:'captured',app:app(),cookie:'BDUSS=SECRET_ONE; STOKEN=TOKEN_ONE'})]})]]);
  const r=await run({store,mode:'capture',request:{url:'https://pan.baidu.com/api/loginstatus',headers:{Cookie:'BDUSS=SECRET_TWO'}}});
  const a=JSON.parse(r.store.get(CK)).accounts[0];assert(!a.cookie.includes('TOKEN_ONE'));assert.equal(a.app,undefined);
});
test('capture ignores other hosts, internal requests and missing BDUSS',async()=>{
  for(const request of [{url:'https://example.com/api/test',headers:{Cookie:'BDUSS=SECRET_ONE'}},{url:'https://pan.baidu.com/api/test',headers:{Cookie:'BDUSS=SECRET_ONE','X-Baidu-Surge-Internal':'1'}},{url:'https://pan.baidu.com/api/test',headers:{Cookie:'STOKEN=TOKEN_ONE'}}]) {
    const r=await run({mode:'capture',request});assert.equal(r.store.has(CK),false);
  }
});
test('capture storage failure always passes through and reports failure',async()=>{const r=await run({failWrite:true,mode:'capture',request:{url:'https://pan.baidu.com/api/test',headers:{Cookie:'BDUSS=SECRET_ONE'}}});assert(r.text.includes('保存失败'));});
test('basic flow signs, answers answer=0, refreshes PC balance, reports ETA',async()=>{
  const r=await run({accounts:[account({dailyGrowth:30})]});assert.equal(mutations(r).length,3);assert(r.text.includes('约 3 天'));assert(r.calls.some(c=>c.url.includes('answer=0')));assert(r.text.includes('PC 积分当前余额'));assert(!r.store.has(LK));
});
test('already signed string flags never trigger mutations',async()=>{
  const r=await run({accounts:[account()],respond:u=>u.pathname.endsWith('getdailyquestion')?{errno:0,data:{answer_status:'1'}}:u.pathname==='/coins/pc/signinlist'?{errno:0,data:{signed_today:'1'}}:u.searchParams.get('method')==='signinlist'?{error_code:0,data:{today_signed:'1'}}:undefined});assert.equal(mutations(r).length,0);
});
test('check mode performs zero account mutations even with full native config',async()=>{const r=await run({mode:'check',accounts:[account({taskcenter:true,app:app(),makeup:true})]});assert.equal(mutations(r).length,0);assert(!paths(r).includes('/'));assert(r.text.includes('只读'));});
test('invalid BDUSS stops remaining account tasks',async()=>{const r=await run({accounts:[account()],respond:u=>u.searchParams.get('method')==='signinlist'?{error_code:-6}:undefined});assert.equal(mutations(r).length,0);assert(!paths(r).includes('/coins/pc/signinlist'));assert(r.text.includes('已失效'));});
test('HTML, HTTP failure, network failure remain errors; other steps continue',async()=>{
  for(const response of [{raw:'<html>SECRET_ONE</html>'},{httpStatus:403},{networkError:true}]) {
    const r=await run({accounts:[account()],respond:u=>u.searchParams.get('method')==='signinlist'?response:undefined});assert(paths(r).includes('/coins/pc/signin'));assert(!r.text.includes('secret?'));
  }
});
test('no inferred ETA when dailyGrowth or thresholds absent',async()=>{
  const r=await run({accounts:[account()],respond:u=>u.searchParams.get('method')==='config'?{error_code:0,data:{level_detail:{daily_increase:{svip:{vip2_1y:30}}}}}:undefined});assert(!r.text.includes('约 '));assert(r.text.includes('无可靠等级'));
});
test('BDUSS-only account skips all taskcenter endpoints',async()=>{const r=await run({accounts:[account({taskcenter:true,cookie:'BDUSS=SECRET_ONE'})]});assert(!paths(r).some(p=>p.startsWith('/coins/taskcenter')));assert(r.text.includes('缺少 STOKEN'));});
test('no native z does not send forged Android params',async()=>{const r=await run({accounts:[account({taskcenter:true})]});assert(!paths(r).some(p=>p.startsWith('/coins/taskcenter')));assert(r.text.includes('无法生成'));});
test('web capture CUID supports taskcenter without native z',async()=>{const r=await run({accounts:[account({taskcenter:true,cookie:'BDUSS=SECRET_ONE; STOKEN=TOKEN_ONE; MAWEBCUID=web123'})]});const req=r.calls.find(c=>new URL(c.url).pathname==='/coins/taskcenter/signin');assert.equal(new URL(req.url).searchParams.get('clienttype'),'5');assert(!new URL(req.url).searchParams.has('z'));});
test('web param error cached for 14 days',async()=>{
  const a=account({taskcenter:true,cookie:'BDUSS=SECRET_ONE; STOKEN=TOKEN_ONE; MAWEBCUID=web123'});
  const r=await run({accounts:[a],respond:u=>u.pathname==='/coins/taskcenter/signin'?{errno:2}:undefined});
  const n=await run({store:r.store});assert(!paths(n).includes('/coins/taskcenter/signin'));assert(n.text.includes('暂缓'));
});
test('native params match RFC MD5, encode device and complete offlinepackage',async()=>{
  const r=await run({accounts:[account({taskcenter:true,web:false,app:app()})]});
  const c=r.calls.find(c=>new URL(c.url).pathname==='/coins/taskcenter/signin'), p=new URL(c.url).searchParams;
  assert.equal(p.get('rchannel'),digest('1e34f40405355a992583c9d7b166cd39'+'123'+p.get('time')+p.get('channel')));assert.equal(p.get('cuid'),app().device);assert.equal(p.get('devuid'),app().device);assert.deepEqual(JSON.parse(p.get('offlinepackage')),app().offlinepackage);assert.equal(p.get('task_id'),'1666916321758720');
});
test('native z expiry, wrong account, mismatched UA and incomplete params skip',async()=>{
  for(const change of [{capturedAt:now-90000},{uid:'999'},{ua:'bad UA'},{offlinepackage:{}},{device:'bad'},{z:''}]) {
    const r=await run({accounts:[account({taskcenter:true,web:false,app:app(change)})]});assert(!paths(r).some(p=>p.startsWith('/coins/taskcenter')));
  }
});
test('native already-signed string=1 does not sign or report device',async()=>{const r=await run({accounts:[account({taskcenter:true,app:app()})],respond:u=>u.pathname==='/coins/taskcenter/signinlist'?{errno:0,data:{signed_today:'1'}}:undefined});assert(!paths(r).includes('/coins/taskcenter/signin'));assert(!paths(r).includes('/coins/taskcenter/checkdevmp'));});
test('risk cooldown persists and stops repeat, fallback and makeup',async()=>{
  const a=account({taskcenter:true,web:false,app:app(),makeup:true,legacy:true});
  const r=await run({accounts:[a],respond:u=>u.pathname==='/coins/taskcenter/signin'?{errno:9312}:undefined});assert(!paths(r).includes('/coins/taskcenter/supptasklist'));assert(!paths(r).includes('/coins/center/home'));
  const n=await run({store:r.store});assert(!paths(n).some(p=>p.startsWith('/coins/taskcenter')));assert(n.text.includes('冷却中'));
});
test('native errno=2 does not claim already-signed and stops makeup',async()=>{const r=await run({accounts:[account({taskcenter:true,web:false,app:app(),makeup:true})],respond:u=>u.pathname==='/coins/taskcenter/signin'?{errno:2}:undefined});assert(r.text.includes('参数校验'));assert(!paths(r).includes('/coins/taskcenter/supptasklist'));});
test('makeup uses most recent missed dates and free cards',async()=>{const r=await run({accounts:[account({taskcenter:true,web:false,app:app(),makeup:true,maxMakeup:1})]});const p=r.calls.filter(c=>new URL(c.url).pathname==='/coins/taskcenter/suppsignin');assert.equal(p.length,1);assert.equal(new URL(p[0].url).searchParams.get('day'),'3');});
test('makeup does not spend coins by default',async()=>{const r=await run({accounts:[account({taskcenter:true,web:false,app:app(),makeup:true})],respond:u=>u.pathname==='/coins/taskcenter/supptasklist'?{errno:0,data:{supp_type:3,coins_consumed:10}}:undefined});assert(!paths(r).includes('/coins/taskcenter/suppsignin'));});
test('makeup enforces total coin budget and reserves before submission',async()=>{const r=await run({accounts:[account({taskcenter:true,web:false,app:app(),makeup:true,allowCoins:true,maxCoins:15})],respond:u=>u.pathname==='/coins/taskcenter/supptasklist'?{errno:0,data:{supp_type:3,coins_consumed:10}}:undefined});assert.equal(paths(r).filter(p=>p==='/coins/taskcenter/suppsignin').length,1);assert(r.text.includes('预算占用 10'));});
test('makeup rejects unknown coin price rather than coercing null to zero',async()=>{const r=await run({accounts:[account({taskcenter:true,web:false,app:app(),makeup:true,allowCoins:true,maxCoins:100})],respond:u=>u.pathname==='/coins/taskcenter/supptasklist'?{errno:0,data:{supp_type:3,coins_consumed:null}}:undefined});assert(!paths(r).includes('/coins/taskcenter/suppsignin'));});
test('uncertain taskcenter network result blocks subsequent makeup',async()=>{const r=await run({accounts:[account({taskcenter:true,web:false,app:app(),makeup:true})],respond:u=>u.pathname==='/coins/taskcenter/signin'?{networkError:true}:undefined});assert(!paths(r).includes('/coins/taskcenter/supptasklist'));});
test('legacy fallback only explicitly enabled and version-directed',async()=>{const r=await run({accounts:[account({taskcenter:true,web:false,app:app(),legacy:true})],respond:u=>u.pathname==='/coins/taskcenter/signin'?{errno:9230}:undefined});assert(paths(r).includes('/coins/center/signinv2'));assert(r.text.includes('业务拒绝'));});
test('Set-Cookie merged per account with domain/path/expiry and no cross-account leak',async()=>{
  const r=await run({accounts:[account(),account({id:'two',cookie:'BDUSS=SECRET_TWO; STOKEN=TOKEN_TWO'})],respond:(u,o)=>u.pathname==='/api/loginstatus'&&o.headers.Cookie.includes('SECRET_ONE')?{errno:0,login_info:{uk:'123'},headers:[{field:'Set-Cookie',value:'PANWEB=REFRESH_SECRET; Domain=.baidu.com; Path=/'},{field:'Set-Cookie',value:'BAD=wrong; Domain=evil.com; Path=/'},{field:'Set-Cookie',value:'DEAD=old; Max-Age=0; Path=/'},{field:'Set-Cookie',value:'PATHONLY=yes; Path=/api'},{field:'Set-Cookie',value:'STOKEN=REFRESH_SECRET; Domain=.baidu.com; Path=/'}]}:undefined});
  const membership=r.calls.filter(c=>new URL(c.url).pathname==='/rest/2.0/membership/user');assert(membership[0].headers.Cookie.includes('PANWEB=REFRESH_SECRET'));assert(!membership[0].headers.Cookie.includes('TOKEN_ONE'));assert(!membership[0].headers.Cookie.includes('BAD='));assert(!membership[0].headers.Cookie.includes('DEAD='));assert(!membership[0].headers.Cookie.includes('PATHONLY='));assert(!membership[1].headers.Cookie.includes('REFRESH_SECRET'));assert(membership[1].headers.Cookie.includes('TOKEN_TWO'));
});
test('per-account rotation makes bounded progress',async()=>{
  const r=await run({accounts:[account(),account({id:'two',cookie:'BDUSS=SECRET_TWO; STOKEN=TOKEN_TWO'})],config:{maxAccountsPerRun:1}});assert.equal(JSON.parse(r.store.get(SK)).cursor,1);
  const n=await run({store:r.store});assert(n.calls[0].headers.Cookie.includes('SECRET_TWO'));assert.equal(JSON.parse(n.store.get(SK)).cursor,0);
});
test('active run lock makes zero HTTP calls; expired lock recovered',async()=>{
  const store=new Map([[CK,JSON.stringify({accounts:[account()]})],[LK,JSON.stringify({until:now+300,token:'other'})]]);const r=await run({store});assert.equal(r.calls.length,0);
  store.set(LK,JSON.stringify({until:now-1}));const n=await run({store});assert(n.calls.length>0);assert(!store.has(LK));
});
test('explicit account selector runs only that account',async()=>{
  const r=await run({accounts:[account(),account({id:'two',cookie:'BDUSS=SECRET_TWO; STOKEN=TOKEN_TWO'})],intent:JSON.stringify({account:'two'})});assert(r.calls.every(c=>c.headers.Cookie.includes('SECRET_TWO')));
});
test('one-time challenge responses are scoped, allowlisted, never persisted',async()=>{
  const r=await run({accounts:[account({taskcenter:true,web:false,app:app()})],intent:JSON.stringify({account:'one',ac:'ev=task&zid=ephemeral_zid&clienttype=99&z=fake',ds:'ephemeral_ds',tk:'ephemeral_tk'})});
  const req=r.calls.find(c=>new URL(c.url).pathname==='/coins/taskcenter/signin'), p=new URL(req.url).searchParams;
  assert.equal(p.get('ev'),'task');assert.equal(p.get('zid'),'ephemeral_zid');assert.equal(p.get('ds'),'ephemeral_ds');assert.equal(p.get('clienttype'),'1');assert.equal(p.get('z'),app().z);assert(!JSON.stringify([...r.store]).includes('ephemeral_'));assert(!r.text.includes('ephemeral_'));
  assert(r.calls.filter(c=>new URL(c.url).pathname!=='/coins/taskcenter/signin').every(c=>!c.url.includes('ephemeral_')));
  const n=await run({accounts:[account()],intent:JSON.stringify({ds:'ephemeral_ds'})});assert.equal(n.calls.length,0);
});
test('host-only refresh wins over broad original Cookie without duplicates',async()=>{
  const r=await run({accounts:[account()],respond:u=>u.pathname==='/api/loginstatus'?{errno:0,login_info:{uk:'123'},headers:[{field:'Set-Cookie',value:'STOKEN=REFRESH_SECRET; Path=/'}]}:undefined});
  const c=r.calls.find(c=>new URL(c.url).pathname==='/rest/2.0/membership/user').headers.Cookie;assert(c.includes('STOKEN=REFRESH_SECRET'));assert.equal((c.match(/STOKEN=/g)||[]).length,1);
});
test('corrupt local config produces actionable notification without secrets',async()=>{const r=await run({store:new Map([[CK,'{SECRET_ONE']])});assert(r.text.includes('格式损坏'));assert.equal(r.calls.length,0);});
test('setup example is inert; clear removes all module data',async()=>{
  const r=await run({source:setup});assert(!r.store.has(CK));
  const store=new Map([[CK,'x'],[SK,'x'],[LK,'x']]);const n=await run({store,source:setup.replace('const action = "example"','const action = "clear"')});assert.equal(n.store.size,0);
});
test('module has cron, wake, notification-capable JS and narrow MITM host',async()=>{
  const module=fs.readFileSync(path.join(__dirname,'baidu-netdisk.sgmodule'),'utf8');assert(module.includes('cronexp="30 8 * * *"'));assert(module.includes('cronexp="*/6 * * * *"'));assert(module.includes('wake-system=true'));assert(module.includes('hostname = %APPEND% pan.baidu.com'));assert(!module.includes('requires-body=true'));for(const match of module.matchAll(/script-path=([^,\r\n]+)/g)){const v=match[1];const name=v.startsWith('https://')?new URL(v).pathname.split('/').pop():v;assert(fs.existsSync(path.join(__dirname,name)));}
});
test('capture queues first run and requests separate worker without waiting for it',async()=>{
  const r=await run({mode:'capture',api:true,request:{url:'https://pan.baidu.com/api/loginstatus',headers:{Cookie:'BDUSS=SECRET_ONE; STOKEN=TOKEN_ONE'}}});
  assert.equal(r.apiCalls.length,1);assert.equal(r.apiCalls[0].body.script_name,'Baidu-Pending');assert(JSON.parse(r.store.get(CK)).accounts[0].autoCapturePending);assert.equal(r.calls.length,0);
  const n=await run({store:r.store,mode:'pending'});assert(n.calls.length>0);assert(n.text.includes('获取 Cookie 后的签到结果'));assert(!JSON.parse(n.store.get(CK)).accounts[0].autoCapturePending);
  const same=await run({store:r.store,mode:'capture',api:true,request:{url:'https://pan.baidu.com/api/loginstatus',headers:{Cookie:'BDUSS=SECRET_ONE; STOKEN=TOKEN_ONE'}}});assert.equal(same.apiCalls.length,0);
});
test('already signed capture reports status and suppresses same-day daily repeat',async()=>{
  const r=await run({mode:'capture',request:{url:'https://pan.baidu.com/api/loginstatus',headers:{Cookie:'BDUSS=SECRET_ONE; STOKEN=TOKEN_ONE'}}});
  const n=await run({store:r.store,mode:'pending',respond:u=>u.pathname.endsWith('getdailyquestion')?{errno:0,data:{answer_status:1}}:u.pathname==='/coins/pc/signinlist'?{errno:0,data:{signed_today:1}}:u.searchParams.get('method')==='signinlist'?{error_code:0,data:{today_signed:1}}:undefined});
  assert(n.text.includes('今日已签到'));assert.equal(mutations(n).length,0);
  const sameDay=await run({store:r.store,mode:'run'});assert.equal(sameDay.calls.length,0);assert.equal(sameDay.notifications.length,0);
  const config=JSON.parse(r.store.get(CK));config.accounts[0].autoLastCompletedDay='2000-01-01';r.store.set(CK,JSON.stringify(config));
  const nextDay=await run({store:r.store,mode:'run'});assert(nextDay.calls.length>0);
});
test('upgrade with existing cookie schedules one automatic run',async()=>{
  const store=new Map([[CK,JSON.stringify({accounts:[account({id:'captured'})]})]]);
  const r=await run({store,mode:'capture',request:{url:'https://pan.baidu.com/api/loginstatus',headers:{Cookie:'BDUSS=SECRET_ONE; STOKEN=TOKEN_ONE'}}});assert(JSON.parse(r.store.get(CK)).accounts[0].autoCapturePending);
});
test('busy worker leaves pending item for later retry',async()=>{
  const r=await run({mode:'capture',request:{url:'https://pan.baidu.com/api/loginstatus',headers:{Cookie:'BDUSS=SECRET_ONE'}}});r.store.set(LK,JSON.stringify({token:'other',until:now+100}));
  const b=await run({store:r.store,mode:'pending'});assert.equal(b.calls.length,0);assert(JSON.parse(r.store.get(CK)).accounts[0].autoCapturePending);
  r.store.delete(LK);const n=await run({store:r.store,mode:'pending'});assert(n.calls.length>0);assert(!JSON.parse(r.store.get(CK)).accounts[0].autoCapturePending);
});
test('updated credentials while running remain queued for newer version',async()=>{
  const r=await run({mode:'capture',request:{url:'https://pan.baidu.com/api/loginstatus',headers:{Cookie:'BDUSS=SECRET_ONE'}}});let changed=false;
  await run({store:r.store,mode:'pending',respond:u=>{if(!changed){changed=true;const c=JSON.parse(r.store.get(CK));c.accounts[0].cookie='BDUSS=SECRET_ONE; STOKEN=TOKEN_TWO';c.accounts[0].autoCapturePending='new-version';c.accounts[0].autoCaptureFingerprint='new-version';r.store.set(CK,JSON.stringify(c));}return undefined;}});
  assert.equal(JSON.parse(r.store.get(CK)).accounts[0].autoCapturePending,'new-version');
});
test('no pending item causes no network and no notification',async()=>{const r=await run({mode:'pending',accounts:[account()]});assert.equal(r.calls.length,0);assert.equal(r.notifications.length,0);});
test('timeout and API callback both finish capture only once',async()=>{const r=await run({mode:'capture',api:true,timerFirst:true,request:{url:'https://pan.baidu.com/api/loginstatus',headers:{Cookie:'BDUSS=SECRET_ONE'}}});assert.equal(r.apiCalls.length,1);});
(async()=>{
  let passed=0;
  for(const [name,fn] of tests) { try {await fn();passed++;console.log('PASS '+name);} catch(e) {console.error('FAIL '+name);console.error(e);process.exitCode=1;} }
  console.log(`${passed}/${tests.length} tests passed (offline Surge API mocks; not iOS/device or live Baidu proof)`);
})();

