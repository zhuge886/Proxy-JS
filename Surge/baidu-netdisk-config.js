/* 可选配置导入器：只在 Surge 本机编辑。不要把填入凭据后的文件上传公开仓库。
 * 默认无需运行本文件：模块捕获 Cookie 后即可运行基础签到。
 * 将 action 改为 merge 并编辑 CONFIG，再手动运行 Baidu-Config。
 * merge 按 id 合并账号；replace 整体替换；clear 删除本模块全部本地数据。
 */
const action = "example";
const CONFIG = {
  notify: true,
  maxAccountsPerRun: 2,
  accounts: [
    {
      id: "manual1",
      name: "账号1",
      cookie: "BDUSS=在此填写; STOKEN=在此填写",
      growth: true,
      question: true,
      pc: true,
      taskcenter: true,
      web: true,
      legacy: false,
      makeup: false,
      allowCoins: false,
      maxCoins: 0,
      maxMakeup: 5,
      dailyGrowth: 0,
      levelTable: [],
      // 可选 App 参数：从同一账号、同一 Android 设备的实际请求取值。
      // 无这些参数也可执行成长值、答题、PC、网页端尝试。
      app: null
      /* app: {
        uid: "实际登录账号的 uk（字符串）",
        device: "真实 cuid/devuid",
        z: "本账号同设备新鲜 z",
        capturedAt: 0, // 获取 z 时的 Unix 秒时间戳，超过 24 小时停止使用
        channel: "android_实际版本_实际型号_bd-netdisk_1027840c",
        ua: "同一设备实际 WebView User-Agent",
        version: "13.34.3",
        versioncode: "4228",
        offlinepackage: { "2004": { "version": 93 } }
        // 上面的 offlinepackage 仅展示结构；须替换为实际请求的完整对象。
      } */
    }
  ]
};

(function () {
  const key = "BaiduNetdisk.Config.v1";
  try {
    if (action === "example") {
      $notification.post("百度网盘配置", "尚未导入示例", "自动获取 Cookie 无需导入；手动配置请先编辑本文件。");
      return;
    }
    if (action === "clear") {
      [key, "BaiduNetdisk.State.v1", "BaiduNetdisk.Lock.v1"].forEach(k => {
        if (!$persistentStore.write(null, k)) throw new Error("删除失败");
      });
      $notification.post("百度网盘配置", "已清除", "本模块的账号、设备状态及运行锁已删除。");
      return;
    }
    if (!["merge", "replace"].includes(action)) throw new Error("action 只支持 example/merge/replace/clear");
    if (!Array.isArray(CONFIG.accounts)) throw new Error("accounts 必须是数组");
    const seen = new Set();
    for (const a of CONFIG.accounts) {
      if (!/^[a-zA-Z0-9_-]{1,40}$/.test(a.id) || seen.has(a.id)) throw new Error("账号 id 无效或重复");
      seen.add(a.id);
      if (typeof a.cookie !== "string" || !/(?:^|;\s*)BDUSS=[^;\s]+/.test(a.cookie) || /在此填写|[\r\n]/.test(a.cookie)) throw new Error("请填写有效格式的 Cookie");
    }
    let value = CONFIG;
    if (action === "merge") {
      const old = JSON.parse($persistentStore.read(key) || '{"accounts":[]}');
      const accounts = (old.accounts || []).filter(a => !seen.has(a.id)).concat(CONFIG.accounts);
      value = Object.assign({}, old, CONFIG, { accounts });
    }
    if (!$persistentStore.write(JSON.stringify(value), key)) throw new Error("保存失败");
    $notification.post("百度网盘配置", "配置已保存", "共 " + value.accounts.length + " 个账号。打开网盘 App 获取 Cookie 后将自动检查并签到。");
  } catch (e) {
    // 不输出用户输入、JSON 解析错误正文或凭据。
    $notification.post("百度网盘配置", "导入失败", "检查配置格式、id 和 Cookie，或存储空间。未输出凭据。");
  } finally { $done(); }
})();

