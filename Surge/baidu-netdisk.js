/* 百度网盘 Surge JavaScript 移植，2026-10-29。
 * 协议依据：xvkong233/qlscript baidu_netdisk.py
 * source commit: 91150efc89baec0a857203555b964502fafa58e7
 * 无 Python、Node、第三方包或动态远程代码依赖。运行于 Surge iOS 5.9+。
 * 仅调用 pan.baidu.com。服务端成功码及登录状态必须实际校验。
 */
(function () {
  "use strict";
  const CONFIG_KEY = "BaiduNetdisk.Config.v1";
  const STATE_KEY = "BaiduNetdisk.State.v1";
  const LOCK_KEY = "BaiduNetdisk.Lock.v1";
  const BASE = "https://pan.baidu.com";
  const WAP = { app_id: "250528", web: "1", clienttype: "5", clientinfo: "wap" };
  const TASK = { task_id: "1666916321758720", task_id_str: "1666916321758720", task_from: "task_sys_daily", is_growth: "0" };
  const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
  const PC_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) baidunetdisk/8.8.8 Chrome/108.0.5359.215 Electron/22.3.27 Safari/537.36;netdisk;8.8.8.101;PC;PC-Windows;10.0.26200;WindowsBaiduYunGuanJia";
  const RISK = [8001, 8011, 8024, 9302, 9306, 9312, 35103, 35104];
  const clock = () => Math.floor(Date.now() / 1000);
  function localDay() { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  const enabled = (v, fallback) => v === undefined ? fallback : v === true;
  const int = (v, fallback, lo, hi) => Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.floor(Number(v)))) : fallback;
  const flag = v => v === true || v === 1 || v === "1" ? true : v === false || v === 0 || v === "0" ? false : null;
  const ec = d => d.errno !== undefined ? Number(d.errno) : d.error_code !== undefined ? Number(d.error_code) : null;
  const loginError = d => ec(d) === -6 || /未登录|登录失效|请.*登录|not.?login|bduss.*(?:invalid|expired)|stoken.*(?:invalid|expired)/i.test(String(d.error_msg || d.show_msg || d.error || d.errmsg || ""));
  const form = o => Object.keys(o).filter(k => o[k] !== undefined && o[k] !== null).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(String(o[k]))).join("&");
  function pairs(text, sep) {
    const out = {};
    String(text || "").split(sep).forEach(part => {
      const i = part.indexOf("=");
      if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    });
    return out;
  }
  function query(text) {
    const out = {};
    String(text || "").split("&").forEach(p => {
      const i = p.indexOf("=");
      if (i > 0) {
        try { out[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1).replace(/\+/g, " ")); } catch (_) { /* ignore malformed field */ }
      }
    });
    return out;
  }
  function read(key, fallback) {
    const s = $persistentStore.read(key);
    if (!s) return fallback;
    try { return JSON.parse(s); } catch (_) { throw new Error("本地存储格式损坏，请重新导入配置"); }
  }
  function write(key, value) {
    if (!$persistentStore.write(JSON.stringify(value), key)) throw new Error("本地存储写入失败");
  }
  function post(subtitle, body) { $notification.post("百度网盘", subtitle, body); }
  function errorText(d) {
    const code = ec(d);
    const names = { "2": "参数校验未通过，检查账号与设备参数", "-6": "登录失效，请重新获取 Cookie", "9230": "任务业务拒绝，不能据此认定已签到", "9312": "设备重复，已冷却", "8001": "活动或风控拒绝", "8011": "请求频繁", "8024": "风控拒绝", "9302": "手机号重复", "9306": "需绑定手机号", "35103": "令牌校验失败", "35104": "令牌与账号不匹配" };
    return (names[String(code)] || "服务端未确认成功") + "（code=" + (code === null ? "缺失" : code) + "）";
  }
  function capture() {
    const r = $request;
    if (!/^https:\/\/pan\.baidu\.com\/(?:api\/|rest\/2\.0\/|coins\/|act\/)/i.test(r.url)) return;
    const headers = {};
    Object.keys(r.headers || {}).forEach(k => { headers[k.toLowerCase()] = r.headers[k]; });
    if (headers["x-baidu-surge-internal"]) return;
    const cookies = pairs(headers.cookie, /;\s*/);
    const q = query((r.url.split("?")[1] || "").split("#")[0]);
    if (!cookies.BDUSS && (q.BDUSS || q.bduss)) cookies.BDUSS = q.BDUSS || q.bduss;
    if (!cookies.STOKEN && (q.STOKEN || q.stoken)) cookies.STOKEN = q.STOKEN || q.stoken;
    if (!cookies.BDUSS || /[\r\n;]/.test(cookies.BDUSS)) return;
    const config = read(CONFIG_KEY, { accounts: [] });
    if (!Array.isArray(config.accounts)) throw new Error("accounts 格式错误");
    const matched = config.accounts.find(a => pairs(a.cookie, /;\s*/).BDUSS === cookies.BDUSS);
    // 自动捕获只维护一个 captured 槽位。手工账号仅在 BDUSS 相同时更新。
    const old = matched || config.accounts.find(a => a.id === "captured");
    const same = old && pairs(old.cookie, /;\s*/).BDUSS === cookies.BDUSS;
    const merged = Object.assign({}, same ? pairs(old.cookie, /;\s*/) : {}, cookies);
    const serialized = Object.keys(merged).filter(k => /^[A-Za-z0-9_-]+$/.test(k) && !/[\r\n;]/.test(merged[k])).map(k => k + "=" + merged[k]).join("; ");
    const fingerprint = md5(merged.BDUSS + "\n" + (merged.STOKEN || ""));
    const changed = !same || old.autoCaptureFingerprint !== fingerprint;
    const account = Object.assign({}, same ? old : {}, { id: same ? old.id : "captured", name: same ? old.name : "App 自动获取", cookie: serialized });
    if (changed) { account.autoCaptureFingerprint = fingerprint; account.autoCapturePending = fingerprint; }
    const target = config.accounts.findIndex(a => a.id === account.id);
    if (target >= 0) config.accounts[target] = account; else config.accounts.push(account);
    if (!old || old.cookie !== serialized || changed) write(CONFIG_KEY, config);
    if (changed) {
      post("Cookie 已保存", merged.STOKEN ? "正在自动启动签到检查，结果将另行通知。" : "正在自动启动基础签到；可继续访问会员页获取 STOKEN。");
      return true;
    }
    return false;
  }

  // RFC 1321 MD5；仅用于原协议 rchannel 与本地状态指纹，不作为加密存储。
  function md5(text) {
    const b = unescape(encodeURIComponent(String(text))).split("").map(c => c.charCodeAt(0));
    const bits = b.length * 8;
    b.push(128);
    while (b.length % 64 !== 56) b.push(0);
    for (let i = 0; i < 8; i++) b.push(Math.floor(bits / Math.pow(256, i)) & 255);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const shifts = [7,12,17,22, 5,9,14,20, 4,11,16,23, 6,10,15,21];
    for (let off = 0; off < b.length; off += 64) {
      const m = [];
      for (let j = 0; j < 16; j++) m[j] = b[off+j*4] | b[off+j*4+1]<<8 | b[off+j*4+2]<<16 | b[off+j*4+3]<<24;
      let a = a0, bb = b0, c = c0, d = d0;
      for (let i = 0; i < 64; i++) {
        let f, g;
        if (i < 16) { f = (bb & c) | (~bb & d); g = i; }
        else if (i < 32) { f = (d & bb) | (~d & c); g = (5*i+1)%16; }
        else if (i < 48) { f = bb ^ c ^ d; g = (3*i+5)%16; }
        else { f = c ^ (bb | ~d); g = (7*i)%16; }
        const x = (a + f + (Math.floor(Math.abs(Math.sin(i+1))*4294967296) | 0) + m[g]) | 0;
        const n = shifts[Math.floor(i/16)*4+i%4];
        const next = (bb + ((x << n) | (x >>> (32-n)))) | 0;
        a = d; d = c; c = bb; bb = next;
      }
      a0 = (a0+a)|0; b0 = (b0+bb)|0; c0 = (c0+c)|0; d0 = (d0+d)|0;
    }
    return [a0,b0,c0,d0].map(v => [0,8,16,24].map(s => ((v>>>s)&255).toString(16).padStart(2,"0")).join("")).join("");
  }

  // Account-local cookie jar. Disable Surge's shared cookie handling to isolate accounts.
  class Jar {
    constructor(cookie) {
      this.entries = [];
      const obj = pairs(cookie, /;\s*/);
      Object.keys(obj).forEach(name => this.put({ name, value: obj[name], domain: "baidu.com", path: "/", secure: true }));
    }
    put(c) {
      this.entries = this.entries.filter(v => !(v.name === c.name && v.domain === c.domain && v.path === c.path));
      if (!c.expires || c.expires > Date.now()) this.entries.push(c);
    }
    absorb(headers, path) {
      const list = Array.isArray(headers) ? headers.map(h => [h.field, h.value]) : Object.keys(headers || {}).map(k => [k, headers[k]]);
      list.filter(h => String(h[0]).toLowerCase() === "set-cookie").forEach(h => {
        const values = Array.isArray(h[1]) ? h[1] : [h[1]];
        values.forEach(value => String(value).split(/,(?=\s*[A-Za-z0-9_-]+=)/).forEach(raw => {
          const parts = raw.split(/;\s*/), first = parts.shift(), i = first.indexOf("=");
          if (i <= 0) return;
          const c = { name: first.slice(0,i).trim(), value: first.slice(i+1), domain: "pan.baidu.com", path: path.slice(0,path.lastIndexOf("/")+1) || "/", secure: false };
          let maxAge;
          parts.forEach(p => {
            const j = p.indexOf("="), key = (j<0?p:p.slice(0,j)).toLowerCase(), v = j<0?"":p.slice(j+1);
            if (key === "domain") c.domain = v.replace(/^\./, "").toLowerCase();
            if (key === "path") c.path = v.startsWith("/") ? v : c.path;
            if (key === "expires") c.expires = Date.parse(v);
            if (key === "max-age" && /^-?\d+$/.test(v)) maxAge = Number(v);
            if (key === "secure") c.secure = true;
          });
          if (maxAge !== undefined) c.expires = Date.now() + maxAge*1000;
          if (c.domain === "baidu.com" || c.domain === "pan.baidu.com") this.put(c);
        }));
      });
    }
    header(path) {
      const seen = new Set();
      return this.entries.filter(c => (!c.expires || c.expires > Date.now()) && (path === c.path || path.startsWith(c.path.endsWith("/") ? c.path : c.path+"/"))).sort((a,b) => b.path.length-a.path.length || b.domain.length-a.domain.length).filter(c => {
        if (seen.has(c.name)) return false;
        seen.add(c.name); return true;
      }).map(c => c.name+"="+c.value).join("; ");
    }
    get(name) { return pairs(this.header("/"), /;\s*/)[name] || ""; }
  }

  function calendar(d) {
    const v = d.data || {}, state = v.signin_state || {};
    for (const key of ["signed_today","SignedToday","today_signined","signed"]) {
      const f = flag(state[key] === undefined ? v[key] : state[key]);
      if (f !== null) return f;
    }
    const today = Math.floor((Number(v.date)-Number(v.start_time))/86400)+1;
    if (Number(v.start_time)>0 && Number(v.date)>=Number(v.start_time) && Array.isArray(v.signin_list)) {
      const item = v.signin_list.find(it => Number(it.day) === today);
      if (item) return flag(item.signed);
    }
    return null;
  }
  function levelTable(payload) {
    const strict = {}, loose = {};
    const add = (bucket, lv, val) => {
      if (typeof lv === "boolean" || typeof val === "boolean" || lv === null || val === null || !/^\d+$/.test(String(lv)) || !/^\d+$/.test(String(val))) return;
      if (Number(lv)>=1 && Number(lv)<=20 && Number(val)<=1e9) bucket[Number(lv)] = Number(val);
    };
    function walk(o, depth) {
      if (!o || typeof o !== "object" || depth>12) return;
      if (Array.isArray(o)) {
        if (o.length === 2) add(strict,o[0],o[1]);
        o.forEach(v => walk(v,depth+1)); return;
      }
      const lk = ["level","growth_level","growthlevel","grade","lvl","current_level"].find(k => o[k] !== undefined);
      const vk = ["value","growth_value","growthvalue","min_value","minvalue","need_value","threshold","upgrade_value","score"].find(k => o[k] !== undefined);
      if (lk && vk) add(strict,o[lk],o[vk]);
      Object.keys(o).forEach(k => {
        const v = o[k];
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const tk = ["value","level_value","growth_value","need_value","threshold","min_value","score"].find(x => v[x] !== undefined);
          if (tk) add(strict,k,v[tk]);
        } else add(loose,k,v);
        walk(v,depth+1);
      });
    }
    walk(payload,0);
    for (const bucket of [strict,loose]) {
      const list = Object.keys(bucket).map(k => [Number(k),bucket[k]]).sort((a,b) => a[0]-b[0]);
      if (list.length>=3 && list.every((v,i) => !i || v[1]>=list[i-1][1])) return list;
    }
    return [];
  }

  class Account {
    constructor(a, state, check, deadline, transient) {
      this.a = a; this.state = state; this.check = check; this.deadline = deadline;
      this.jar = new Jar(a.cookie); this.lines = []; this.growth = 0; this.uid = ""; this.appReady = false; this.tcBlocked = false;
      this.transient = transient || {};
    }
    emit(s) { this.lines.push(s); console.log("["+this.a.id+"] "+s); }
    save() { saveState(); }
    async http(path, params, type, raw) {
      if (Date.now()+11000 > this.deadline) throw new Error("达到本次运行时限，剩余项目留待下次");
      const app = this.a.app || {};
      const headers = { Cookie: this.jar.header(path), "User-Agent": type === "pc" ? PC_UA : type === "app" ? app.ua : UA,
        Referer: BASE + (type === "pc" ? "/operation/activitys/goldcoin" : type === "app" || type === "task" ? "/operation/activitys/taskSystem/main" : "/wap/svip/growth/task"),
        Accept: raw ? "text/html,*/*" : "application/json, text/plain, */*", "Accept-Encoding": "identity", "X-Requested-With": "XMLHttpRequest", "X-Baidu-Surge-Internal": "1" };
      const opts = { url: BASE+path+(Object.keys(params||{}).length ? "?"+form(params) : ""), headers, timeout: 10, "auto-cookie": false, "auto-redirect": false, "full-header-mode": true };
      return new Promise((resolve,reject) => {
        $httpClient.get(opts,(err,res,body) => {
          if (err) return reject(new Error("网络请求失败（未自动重试）"));
          const status = res && Number(res.status);
          this.jar.absorb(res && res.headers,path);
          if (status !== 200) return reject(new Error("HTTP "+status+"，请检查网络或重新登录"));
          if (raw) return resolve({});
          let d;
          try { d = JSON.parse(String(body).replace(/^\uFEFF/,"")); } catch (_) { return reject(new Error("响应不是 JSON，请检查登录或网关")); }
          if (!d || typeof d !== "object" || Array.isArray(d)) return reject(new Error("响应结构异常"));
          // Log no URL, parameters, body, or server messages: these can contain credentials.
          console.log("["+this.a.id+"] "+path+" HTTP 200 code="+ec(d));
          resolve(d);
        });
      });
    }
    api(path, params) { return this.http(path,Object.assign({},WAP,params),"wap"); }
    async step(label, fn) {
      if (this.invalid) return;
      try { await fn(); } catch (e) { if (label === "任务中心") this.tcBlocked = true; this.emit(label+": "+e.message); }
    }
    mustLogin(d) {
      if (loginError(d)) { this.invalid = true; throw new Error("BDUSS 已失效，请打开 App 重新获取 Cookie"); }
    }
    async identity() {
      const d = await this.http("/api/loginstatus",{clienttype:"1"},"pc");
      const uk = (d.login_info || {}).uk;
      if (uk && (typeof uk !== "number" || Number.isSafeInteger(uk))) this.uid = String(uk);
      if (!this.uid || this.uid === "0") {
        const f = await this.api("/rest/2.0/xpan/nas",{method:"uinfo"});
        this.mustLogin(f);
        if (f.uk && (typeof f.uk !== "number" || Number.isSafeInteger(f.uk))) this.uid = String(f.uk);
      }
      if (this.state.uid && this.uid && this.state.uid !== this.uid) {
        Object.keys(this.state).forEach(k => delete this.state[k]);
        this.emit("检测到账号切换，已清除该槽位的旧设备状态");
      }
      if (this.uid) { this.state.uid = this.uid; this.save(); }
      this.emit(this.uid && this.uid !== "0" ? "登录账号已识别" : "账号 ID 未确认；基础功能将分别校验，App 通道跳过");
    }
    async growthSign() {
      const d = await this.api("/rest/2.0/membership/level",{method:"signinlist"}); this.mustLogin(d);
      if (ec(d) !== 0) return this.emit("成长值状态: "+errorText(d));
      const v = d.data || {};
      if (flag(v.today_signed) === true) return this.emit("成长值: 今日已签到"+(v.signed_cnt ? "，连续 "+v.signed_cnt+" 天" : ""));
      if (this.check) return this.emit("成长值: "+(flag(v.today_signed)===false ? "今日未签到" : "状态未知")+"（只读）");
      const r = await this.api("/rest/2.0/membership/level",{method:"signin"}); this.mustLogin(r);
      if (ec(r) === 421001) return this.emit("成长值: 今日已签到");
      if (ec(r) !== 0) return this.emit("成长值: "+errorText(r));
      const points = Number((r.result || {}).points);
      if (Number.isFinite(points) && points>=0) this.growth += points;
      this.emit("成长值: 签到成功"+(Number.isFinite(points) ? "，+"+points : ""));
    }
    async question() {
      const d = await this.api("/act/v2/membergrowv2/getdailyquestion",{}); this.mustLogin(d);
      if (ec(d) !== 0 && ec(d) !== null) return this.emit("答题: "+errorText(d));
      const v = d.data || {};
      if (flag(v.answer_status) === true) return this.emit("答题: 今日已完成");
      if (!v.ask_id || v.answer === undefined || v.answer === null) return this.emit("答题: 无题目或服务端未给答案，跳过");
      if (this.check) return this.emit("答题: 可答题（只读，不提交）");
      const r = await this.api("/act/v2/membergrowv2/answerquestion",{ask_id:v.ask_id,answer:v.answer}); this.mustLogin(r);
      if (ec(r) === 9502) return this.emit("答题: 今日已完成");
      if (ec(r) !== 0) return this.emit("答题: "+errorText(r));
      const score = Number((r.data || {}).score);
      if (Number.isFinite(score) && score>=0) this.growth += score;
      this.emit("答题: 提交成功"+(Number.isFinite(score) ? "，+"+score+" 成长值" : ""));
    }
    async membership() {
      const d = await this.api("/rest/2.0/membership/user",{method:"query"}); this.mustLogin(d);
      if (ec(d) !== 0 && ec(d) !== null) return this.emit("会员: "+errorText(d));
      const v = d.level_info || {}, lv = Number(v.current_level), value = Number(v.current_value);
      if (!Number.isFinite(lv) || !Number.isFinite(value)) return this.emit("会员: 未返回有效 level_info");
      let table = levelTable(this.a.levelTable || []);
      if (!table.length) {
        const c = await this.api("/rest/2.0/membership/level",{method:"config"});
        if (ec(c) === 0 || ec(c) === null) table = levelTable(c.data);
      }
      let line = "会员等级 "+lv+"，成长值 "+value;
      const next = table.find(it => it[0]>lv), daily = Number(this.a.dailyGrowth);
      if (next) {
        const need = Math.max(0,next[1]-value);
        line += "；距等级 "+next[0]+" 还差 "+need;
        // Do not infer the account's subscription tier from a global SVIP annual table.
        if (daily>0) line += "，约 "+Math.ceil(need/(daily+this.growth))+" 天（手工每日增量 "+daily+" + 本次任务 "+this.growth+"；估算）";
        else line += "（日增量未配置，不估算天数）";
      } else if (!table.length) line += "；无可靠等级门槛表";
      this.emit(line);
    }
    async pc() {
      const p = {clienttype:"8",win64:"1",vip:"2"};
      const d = await this.http("/coins/pc/signinlist",p,"pc"); this.mustLogin(d);
      if (ec(d) !== 0) return this.emit("PC 积分: "+errorText(d));
      const v = d.data || {};
      if (flag(v.signed_today) === true) return this.emit("PC 积分: 今日已签到，余额 "+(v.points_balance ?? "未知"));
      if (this.check) return this.emit("PC 积分: 今日未确认签到（只读），余额 "+(v.points_balance ?? "未知"));
      const r = await this.http("/coins/pc/signin",{},"pc"); this.mustLogin(r);
      if (ec(r) !== 0) return this.emit("PC 积分: "+errorText(r));
      this.emit("PC 积分: 签到成功");
      const fresh = await this.http("/coins/pc/signinlist",p,"pc");
      if (ec(fresh) === 0) this.emit("PC 积分当前余额 "+((fresh.data || {}).points_balance ?? "未知"));
    }
    validateApp() {
      const a = this.a.app;
      if (!a) return "未配置本账号设备参数";
      if (!this.uid || String(a.uid) !== this.uid) return "设备参数 uid 与当前登录账号不符或账号未确认";
      if (!/^[0-9A-Fa-f]{32}\|[A-Za-z0-9]{8,16}$/.test(a.device || "")) return "真实 cuid/devuid 格式不完整";
      if (!a.z || typeof a.z !== "string" || a.z.length<40) return "缺少本账号 z";
      const age = clock()-Number(a.capturedAt);
      if (!Number.isFinite(age) || age< -300 || age>86400) return "z 获取时间无效或已超过 24 小时";
      const c = /^android_([^_]+)_(.+)_bd-netdisk_[A-Za-z0-9]+$/.exec(a.channel || "");
      if (!c || typeof a.ua !== "string" || !a.ua.includes("Android "+c[1]+";") || !a.ua.includes(c[2])) return "channel 与实际 Android WebView UA 不匹配";
      if (!a.version || !a.versioncode || !a.offlinepackage || typeof a.offlinepackage !== "object" || Array.isArray(a.offlinepackage) || !Object.keys(a.offlinepackage).length) return "版本或 offlinepackage 不完整";
      return "";
    }
    params(includeChallenge) {
      const a = this.a.app, ts = String(clock());
      const p = {z:a.z,clienttype:"1",channel:a.channel,cuid:a.device,devuid:a.device,version:String(a.version),versioncode:String(a.versioncode),offlinepackage:JSON.stringify(a.offlinepackage),themeinfo:"0",app:"android",time:ts,rand:String(Math.floor(Math.random()*900000)+100000),rchannel:md5("1e34f40405355a992583c9d7b166cd39"+this.uid+ts+a.channel)};
      const transient = includeChallenge ? this.transient : {};
      const ac = query(String(transient.ac || "").replace(/^&/,""));
      // Ephemeral challenge responses may only add these known fields, never replace identity.
      ["ev","zid","aid","rand2"].forEach(k => { if (ac[k]) p[k]=ac[k]; });
      ["ds","tk"].forEach(k => { if (transient[k]) p[k]=String(transient[k]); });
      return p;
    }
    cooldown(d) {
      if (RISK.includes(ec(d)) || /dev repeat/i.test(String(d.error || ""))) {
        this.state.cooldown = clock()+43200; this.tcBlocked = true; this.save();
      } else if (ec(d) === 2) { this.state.cooldown = clock()+21600; this.tcBlocked = true; this.save(); }
    }
    async nativeCall(path, extra) {
      const sendChallenge = path === "/coins/taskcenter/signin" && !this.transientUsed;
      const params = Object.assign(this.params(sendChallenge),extra || {});
      if (sendChallenge) this.transientUsed = true;
      const r = await this.http(path,params,"app");
      if (loginError(r)) { this.tcBlocked = true; throw new Error("任务中心登录失效，更新含 STOKEN 的 Cookie"); }
      this.cooldown(r); return r;
    }
    async taskcenter() {
      if (!this.jar.get("STOKEN")) { this.tcBlocked = true; return this.emit("任务中心: 缺少 STOKEN，跳过；基础通道仍可使用"); }
      if (Number(this.state.cooldown)>clock()) { this.tcBlocked = true; return this.emit("任务中心: 冷却中，跳过本次请求"); }
      const why = this.validateApp(); this.appReady = !why;
      const fingerprint = this.appReady ? md5(this.a.app.device+this.a.app.z+this.a.app.channel) : "";
      if (this.appReady) {
        const cal = await this.nativeCall("/coins/taskcenter/signinlist",TASK);
        if (ec(cal)===0 && calendar(cal)===true) return this.emit("任务中心: 今日已签到");
        if (this.tcBlocked) return this.emit("任务中心日历: "+errorText(cal));
        if (this.check) return this.emit("任务中心: "+(ec(cal)===0 && calendar(cal)===false ? "今日未签到" : "今日状态未知")+"（只读）");
      } else if (this.check) return this.emit("任务中心 App: "+why+"；未发请求（只读）");
      // Warm up account-local cookies. No taskSystem page is loaded: it may auto-sign.
      try { await this.http("/",{},"wap",true); } catch (_) { /* not essential */ }
      const webCuid = this.jar.get("MAWEBCUID") || this.jar.get("BAIDUID").split(":")[0];
      if (enabled(this.a.web,true) && webCuid) {
        const fp = md5(webCuid), verdict = this.state.web || {};
        if (verdict.fp === fp && verdict.until>clock()) this.emit("任务中心网页端: 上次参数未通过，暂缓 14 天");
        else {
          const w = await this.http("/coins/taskcenter/signin",Object.assign({clienttype:"5",cuid:webCuid,devuid:webCuid},TASK),"task");
          if (ec(w)===0) return this.emit("任务中心: 网页端完成"+(flag((w.data || {}).signed)===true ? "（今日已签）" : ""));
          if (loginError(w)) { this.tcBlocked = true; return this.emit("任务中心: 登录失效，更新 STOKEN"); }
          if (ec(w)===2) { this.state.web = {fp,until:clock()+14*86400}; this.save(); }
          else this.cooldown(w);
          this.emit("任务中心网页端: "+errorText(w));
          if (this.tcBlocked) return;
        }
      } else this.emit("任务中心网页端: 无网页 CUID 或已关闭，跳过");
      if (!this.appReady) return this.emit("任务中心 App: "+why+"，跳过；Surge 无法生成 sofire z");
      if (this.state.reported !== fingerprint) {
        const report = await this.nativeCall("/coins/taskcenter/checkdevmp",{});
        if (ec(report)===0) { this.state.reported = fingerprint; this.save(); }
        else { this.emit("设备上报: "+errorText(report)); if (this.tcBlocked) return; }
      }
      const r = await this.nativeCall("/coins/taskcenter/signin",TASK);
      if (ec(r)===0) { this.emit("任务中心: App 通道完成"+(flag((r.data || {}).signed)===true ? "（今日已签）" : "")); return; }
      this.emit("任务中心 App: "+errorText(r));
      if (!this.tcBlocked && enabled(this.a.legacy,false)) await this.legacy();
    }
    async legacy() {
      const a = this.a.app, base = {clienttype:"1",cuid:a.device,devuid:a.device,action:"1",ptype:"5"};
      const home = await this.http("/coins/center/home",base,"app"); this.cooldown(home);
      if (loginError(home)) { this.tcBlocked=true; return this.emit("旧积分中心: 登录失效"); }
      if (ec(home)!==0 || this.tcBlocked) return this.emit("旧积分中心: "+errorText(home));
      if (calendar(home)===true) return this.emit("旧积分中心: 今日已签到");
      const version = Number((home.data || {}).signin_version);
      if (![1,2].includes(version)) return this.emit("旧积分中心: 未知签到版本，跳过");
      const p = Object.assign({},base,{app:"android",version:a.version,versioncode:a.versioncode});
      const r = await this.http(version===2 ? "/coins/center/signinv2" : "/coins/center/signin",p,"app"); this.cooldown(r);
      this.emit(ec(r)===0 ? "旧积分中心: 完成" : "旧积分中心: "+errorText(r));
    }
    async makeup() {
      if (!enabled(this.a.taskcenter,true) || this.check || !this.appReady || this.tcBlocked || Number(this.state.cooldown)>clock()) return this.emit("补签: 缺少有效设备参数、只读或冷却中，跳过");
      const cal = await this.nativeCall("/coins/taskcenter/signinlist",{});
      if (ec(cal)!==0) return this.emit("补签检查: "+errorText(cal));
      const v = cal.data || {}, start = Number(v.start_time), now = Number(v.date), today = Math.floor((now-start)/86400)+1;
      if (!(start>0 && now>=start && today<=32) || !Array.isArray(v.signin_list)) return this.emit("补签: 日历结构不完整，跳过");
      const missed = [...new Set(v.signin_list.filter(x => Number.isInteger(Number(x.day)) && Number(x.day)>=1 && Number(x.day)<today && flag(x.signed)===false).map(x => Number(x.day)))].sort((a,b) => b-a);
      let count = 0, spent = 0;
      const cap = int(this.a.maxMakeup,5,1,5), budget = int(this.a.maxCoins,0,0,1000000);
      for (const day of missed.slice(0,5)) {
        if (count>=cap || this.tcBlocked) break;
        const pre = await this.nativeCall("/coins/taskcenter/supptasklist",{day:String(day)});
        if (ec(pre)!==0) { this.emit("补签 day"+day+": "+errorText(pre)); if (this.tcBlocked) break; continue; }
        const p = pre.data || {}, type = Number(p.supp_type), cost = Number(p.coins_consumed);
        if (type!==1 && type!==3) { this.emit("补签 day"+day+": 需完成其他任务，跳过"); continue; }
        if (type===3) {
          if (!enabled(this.a.allowCoins,false) || !/^\d+$/.test(String(p.coins_consumed)) || !Number.isInteger(cost) || cost<0 || spent+cost>budget) { this.emit("补签 day"+day+": 未允许金币、价格未知或超出预算，跳过"); continue; }
          const home = await this.http("/coins/center/home",{ptype:"5",is_pc:"1"},"pc"); this.cooldown(home);
          const balance = Number((home.data || {}).coin_balance);
          if (this.tcBlocked || ec(home)!==0 || !Number.isFinite(balance) || balance<cost) { this.emit("补签 day"+day+": 无法确认足够金币余额，跳过"); continue; }
        }
        // Reserve before mutation so a network timeout cannot lead to overspending in this run.
        if (type===3) spent += cost;
        const result = await this.nativeCall("/coins/taskcenter/suppsignin",{day:String(day),supp_type:String(type)});
        if (ec(result)===0) { count++; this.emit("补签 day"+day+": 成功（"+(type===1 ? "无门槛卡" : cost+" 金币")+"）"); }
        else { this.emit("补签 day"+day+": "+errorText(result)); break; }
      }
      this.emit("补签: 本次成功 "+count+" 天，金币预算占用 "+spent);
    }
    async run() {
      if (!this.jar.get("BDUSS")) return this.emit("缺少 BDUSS，请打开 App 获取 Cookie");
      await this.step("账号识别",() => this.identity());
      if (enabled(this.a.growth,true)) await this.step("成长值",() => this.growthSign());
      if (enabled(this.a.question,true)) await this.step("答题",() => this.question());
      await this.step("会员",() => this.membership());
      if (enabled(this.a.pc,true)) await this.step("PC 积分",() => this.pc());
      if (enabled(this.a.taskcenter,true)) await this.step("任务中心",() => this.taskcenter());
      if (enabled(this.a.makeup,false)) await this.step("补签",() => this.makeup());
    }
  }

  let state;
  function saveState() { write(STATE_KEY,state); }
  async function main(mode, options) {
    if (!["run","check"].includes(mode)) throw new Error("mode 只支持 run 或 check");
    const config = read(CONFIG_KEY,{accounts:[]});
    if (!Array.isArray(config.accounts) || !config.accounts.length) { post("尚未获取 Cookie","开启模块和 MITM，打开百度网盘 App 的会员／签到页。获取成功后会通知。"); return; }
    if (config.accounts.some(a => !/^[A-Za-z0-9_-]{1,40}$/.test(a.id || "") || typeof a.cookie !== "string" || /[\r\n]/.test(a.cookie))) throw new Error("账号配置格式错误");
    if (new Set(config.accounts.map(a => a.id)).size !== config.accounts.length) throw new Error("账号 id 重复");
    let accounts = config.accounts;
    if (options.account) {
      accounts = accounts.filter(a => a.id===options.account);
      if (!accounts.length) throw new Error("指定的账号 id 不存在");
    }
    if ((options.ac || options.ds || options.tk) && !options.account) throw new Error("一次性应答必须指定 account，避免用于其他账号");
    const lock = read(LOCK_KEY,{});
    if (lock.until>clock()) { console.log("已有运行中的任务，跳过重叠触发"); return false; }
    const token = md5(String(Date.now())+Math.random());
    write(LOCK_KEY,{token,until:clock()+190});
    try {
      state = read(STATE_KEY,{accounts:{},cursor:0});
      if (!state.accounts || typeof state.accounts !== "object") throw new Error("账号状态损坏");
      const deadline = Date.now()+165000, check = mode==="check", summaries = [];
      const n = accounts.length, start = check || options.account ? 0 : int(state.cursor,0,0,n-1), max = Math.min(n,int(config.maxAccountsPerRun,2,1,10));
      let visited = 0, skippedToday = 0;
      for (let i=0; i<max && Date.now()+15000<deadline; i++) {
        const a = accounts[(start+i)%n];
        if (!check && !options.fromCapture && a.autoLastCompletedDay===localDay()) {
          skippedToday++;
          if (!options.account) state.cursor=(start+i+1)%n;
          saveState();
          continue;
        }
        const key = a.id, bdussHash = md5(pairs(a.cookie,/;\s*/).BDUSS || "");
        // Reset per-slot state if capture replaced credentials with another account.
        if (!state.accounts[key] || state.accounts[key].bdussHash !== bdussHash) state.accounts[key] = {bdussHash};
        const runner = new Account(a,state.accounts[key],check,deadline,options);
        await runner.run();
        summaries.push("["+String(a.name || a.id).replace(/[\r\n]/g," ").slice(0,40)+"]\n"+runner.lines.join("\n"));
        visited++;
        if (!check && !options.account) state.cursor=(start+i+1)%n;
        saveState();
      }
      if (n>visited+skippedToday) summaries.push("本次处理 "+visited+"/"+n+" 个账号；定时任务按游标轮流处理。增大 maxAccountsPerRun 前请留意运行时限。");
      if (summaries.length && (config.notify!==false || check || options.fromCapture)) post(check ? "只读检查结果" : options.fromCapture ? "获取 Cookie 后的签到结果" : "每日任务结果",summaries.join("\n\n").slice(0,3600));
      return visited + skippedToday > 0;
    } finally {
      const current = read(LOCK_KEY,{});
      if (current.token===token) $persistentStore.write(null,LOCK_KEY);
    }
  }
  async function pending() {
    const config = read(CONFIG_KEY,{accounts:[]});
    if (!Array.isArray(config.accounts)) throw new Error("账号配置格式错误");
    const list = config.accounts.filter(a => a.autoCapturePending).slice(0,2);
    for (const account of list) {
      const fingerprint = account.autoCapturePending;
      const completed = await main("run",{account:account.id,fromCapture:true});
      if (!completed) return; // Lock busy: leave the pending item for the next trigger.
      const current = read(CONFIG_KEY,{accounts:[]});
      const target = (current.accounts || []).find(a => a.id===account.id);
      // A newer capture must remain queued, even if this run just completed.
      if (target && target.autoCapturePending===fingerprint) {
        delete target.autoCapturePending;
        target.autoLastCompletedDay = localDay();
        write(CONFIG_KEY,current);
      }
    }
  }
  let done = false;
  function finish() { if (!done) { done=true; $done(); } }
  let options = query(typeof $argument === "string" ? $argument : "");
  if (typeof $request === "undefined" && typeof $intent !== "undefined" && $intent.parameter) {
    try {
      const input = typeof $intent.parameter === "string" ? JSON.parse($intent.parameter) : $intent.parameter;
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
      options = Object.assign({},options,input);
    } catch (_) { post("参数格式错误","快捷指令参数应为 JSON 对象；一次性应答不会保存。"); finish(); return; }
  }
  const mode = options.mode || "run";
  if (typeof $request !== "undefined") {
    let queued = false;
    try { if (mode==="capture") queued = capture(); } catch (_) { post("Cookie 保存失败","请检查本模块本地配置和存储；请求继续正常发送。"); }
    if (queued && typeof $httpAPI === "function" && typeof setTimeout === "function") {
      // Never keep the intercepted app request waiting for the full task.
      // A periodic pending trigger is the fallback if the API call is interrupted.
      try {
        setTimeout(finish,1000);
        $httpAPI("POST","/v1/scripting/cron/evaluate",{script_name:"Baidu-Pending"},finish);
      } catch (_) { finish(); }
    } else finish();
  } else {
    (mode === "pending" ? pending() : main(mode,options)).catch(e => { console.log("运行结束: "+e.message); post("执行未完成",e.message); }).then(finish);
  }
})();

