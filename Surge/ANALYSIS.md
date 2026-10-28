# 原脚本分析与移植决策

分析对象：[baidu_netdisk.py @ 91150efc89baec0a857203555b964502fafa58e7](https://github.com/xvkong233/qlscript/blob/91150efc89baec0a857203555b964502fafa58e7/baidu_netdisk.py)，2026-10-29 读取，2,859 行。已再次读取固定提交，确认与首次读取的 main 内容相同。上游文件包含互相矛盾的历史注释，因此以下按实际函数实现识别流程；涉及服务端状态的上游说法不当作本次实测结论。

## 原脚本实际功能

| 功能 | 实际接口／行为 | Surge 实现 |
|---|---|---|
| 账号识别 | `/api/loginstatus`，回退 `/rest/2.0/xpan/nas?method=uinfo`；另有昵称查询 | 保留 uk 识别及回退，省略非必要昵称请求 |
| 成长值签到 | membership/level `method=signinlist` 查询、`method=signin` 提交 | 保留，检查 `error_code` 和今日状态；421001 识别为重复 |
| 每日答题 | `/act/v2/membergrowv2/getdailyquestion` 取 `ask_id/answer`，`answerquestion` 提交 | 保留，无答案跳过；0 也是有效答案；9502 识别为已答 |
| PC 积分 | `/coins/pc/signinlist` 带 clienttype=8/win64=1/vip=2；`/coins/pc/signin` 提交，再回查余额 | 保留原参数和 PC UA，签后回查 |
| 任务中心网页通道 | `/coins/taskcenter/signin`，clienttype=5、服务端网页 CUID、task_id/task_from/is_growth | 保留一次尝试；不是保证可用的无 z 通道；code=2 后相同 CUID 缓存 14 天 |
| 任务中心 App 通道 | 日历、checkdevmp 上报、signin；携带 z/channel/cuid/devuid/版本/offlinepackage/themeinfo/app/rchannel 等 | 保留协议构造；要求用户自己的真实匹配参数，明确拒绝缺失／过期／错配 |
| 旧积分中心 | points-center 状态探针和 signinv2/center signin，多个回退分支 | 简化为显式 `legacy=true`；查询 home，用已知版本 1/2 选择一次提交 |
| 自动补签 | taskcenter signinlist → 最近漏签优先 → supptasklist → suppsignin；免费卡和金币 | 实现；默认关闭，金币另行授权预算；最多检查 5 日，成功最多 5 日 |
| 会员查询与预估 | membership/user `query`；level `config` 挖掘等级门槛；本地增量／全局日增量／历史差值 | 查询与门槛解析保留；天数只用手工确认日增量＋本次任务奖励，不猜账号档位 |
| 多账号 | `BAIDUWP_COOKIE` 的 `&`／换行分隔、连续编号环境变量、串行处理 | 改为结构化 accounts 数组，不对 Cookie 使用 `&` 切分；增加 App 自动获取单槽位 |
| 推送 | stdout 过程日志，`notify.py` 可选发送账号结果 | `console.log` 过程状态，`$notification.post` 本机系统通知 |

上游主要函数位置：`BaiduPan` 966 行、成长值 1288 行、答题 1331 行、PC 1366 行、网页签到 1421 行、App 参数 1567 行、上报 1722 行、任务中心主流程 2081 行、补签 2468 行、会员 2537 行、主流程 2670 行、Cookie 环境变量 2701 行、main 2816 行。均可在上述固定版本核对。

## 不能直接带到 Surge 的依赖

| Python／青龙逻辑 | 作用 | 移植处理 |
|---|---|---|
| `requests.Session`、CookieJar、timeout、异常类型 | HTTP、会话与连接处理 | `$httpClient.get` 封装 Promise；关闭共享 auto-cookie/自动跳转，维护单账号 CookieJar；每次请求超时 10 秒 |
| `os.getenv`、环境变量编号扫描 | 配置和多账号 | `$persistentStore` JSON 配置；可选配置导入脚本；快捷指令临时参数 |
| `hashlib.md5` | rchannel 签名与状态哈希 | 内置纯 JS MD5；rchannel=MD5(AK+uid+当前秒时间戳+channel)，用测试对照 Node 标准库 |
| `json`、`re` | 响应／配置解析及匹配 | `JSON.parse/stringify`、JavaScript RegExp；不执行服务端内容 |
| `time.sleep`、`random` | 0–10 分钟启动等待、账号间等待、风控退避 | 移除分钟级等待；用固定 cron、单次运行预算、随机 rand 与持久冷却，避免耗尽 iOS 脚本生命周期 |
| `open()`、设备登记 JSON、z 文件、dump_json | 设备绑定、冷却、历史数据、原始响应落盘 | 配置／账号状态／运行锁改存持久键；不写原始响应 dump，不读取青龙磁盘路径 |
| `gzip`、`zlib`、raw stream | 特殊网关响应手动解压，兼容错误 Content-Encoding | 由 Surge HTTP 层处理常规响应，发送 identity 编码请求；非 JSON 明确失败，不宣称复刻畸形压缩头兜底 |
| `sys.exit`、脚本主入口 | 结束进程 | 异步入口捕获错误并确保 `$done()` 恰好一次 |
| `notify.send` 可选模块 | 青龙通知服务 | Surge 本机通知，不需要青龙通知配置 |
| 外部 `tools/z_provider.py`、Frida、Android sofire SDK | 从运行中的 Android App 取得本账号 z 与设备上下文 | 不在 Surge 内运行。仅接收用户自己的实际结果；JS 不生成 z，不把他人内置值当通用参数 |

原 Python 的直接第三方依赖是 `requests`，另有可选 `notify.py`；其他 import 是 Python 标准库。Frida／Android SDK 属于外部 z 获取链，不是把 requests 移植后便能消除的依赖。

Surge JS 不提供 Python 解释器、青龙环境变量或任意 Python 文件系统。`.sgmodule` 只声明请求触发器／定时任务／配置补丁，实际业务由 `.js` 执行。[Surge 脚本说明](https://manual.nssurge.com/scripting/overview.html)

## 任务中心参数与边界

`Account.params()` 每次请求重算 rchannel 和时间字段；设备值由配置给定并保持不变，cuid=devuid。除上游完整参数外显式发送 time/rand，让签名输入可核对。所有参数均通过 `encodeURIComponent` 编码，避免设备号中的 `|`、offlinepackage JSON 和令牌字符破坏查询串。

进入 App 通道前检查：已识别账号 uk 与 app.uid 相等；设备形态合法；z 非空且 capturedAt 不超过 24 小时；channel 的 Android 版本／型号出现在同一 UA 中；版本字段及 offlinepackage 存在。检查不等于真实设备认证；服务端仍可拒绝。offlinepackage 不能使用文档中的单条结构示例冒充完整包表。

原脚本包含共享设备池、内置 z、轮换设备和多层试探。本移植不采用这些策略：原脚本本身已说明 z 与来源账号相关，复制它不能提供通用成功路径。本移植保留本账号参数和上报能力，在错误码后冷却，不自动换设备。

错误码仅作分类，不根据单个错误猜测成功：code=2 为参数未通过；9230 为业务拒绝；9312 为设备重复；8001 可能涉及活动或风控，不能仅凭它证明“活动已下线”。原文件对此存在不一致的历史注释，故通知采用保守的服务端拒绝描述。

AC 的 ev/zid/aid/rand2 和 ds/tk 支持一次性传入，字段白名单限制覆盖范围，要求指定账号；只附带一次 App 签到，不存储、不重试、不生成。用户完成挑战不代表令牌可以长期循环使用。

## 自动获取 Cookie 的新增链路

`Baidu-Cookie` 是 http-request 脚本。它不会启动 App、替用户登录或读取 App 沙盒；它在用户打开 App 后，处理经过 Surge 的匹配请求。第一次获得有效格式 BDUSS 时保存配置并通知；同 BDUSS 更新 Cookie；自动槽位切换账号时不继承旧 STOKEN、设备参数或开关。手工账号只有 BDUSS 相同才被自动更新。获取新凭据或从旧版升级后的首次捕获会标记待处理并尝试调用 Surge 内置 HTTP API 启动独立 `Baidu-Pending` cron，HTTP 请求最多等待约 1 秒；每 6 分钟的非唤醒定时器负责兜底，空队列不请求百度。账号正在运行时保留队列，新凭据不会被旧任务清除。相同凭据不反复触发，当日完成后跳过同一天的每日任务，次日继续。自动触发、系统调度仍需实机验证。

不抓取请求体，避免为了获取凭据缓冲上传内容；不增加 passport 等其他域名；不把访问令牌误当 BDUSS。App 如果没有匹配的可解密 Cookie／查询字段，本规则不会有通知，需进入 App H5 页面或手工导入。这是必须在目标 App 版本实机验收的条件。

MITM 总开关和用户信任的 CA 是前提；模块只追加 pan.baidu.com。一个请求最多运行一个同类型处理脚本，既有配置可能优先匹配。[Surge HTTP 请求脚本](https://manual.nssurge.com/scripting/http-request.html)

## 生命周期与数据

配置键：`BaiduNetdisk.Config.v1`；状态键：`BaiduNetdisk.State.v1`；运行锁：`BaiduNetdisk.Lock.v1`。Cookie 明文保存；本次新增 Set-Cookie 仅留在该账号本次运行会话内。每次调用 `$done()` 结束生命周期，已发出的请求无自动重试。锁 190 秒自动失效，用于减少重复触发；存储读写没有 CAS，因此不提供跨并发运行的事务保证。

补签默认关闭；开启后先检查日历和可用补签类型。金币必须 allowCoins=true 且在单次预算内，提交前占用预算；请求失败时停止本次补签，避免同次反复扣费。这个预算是本次脚本上限，不是整个账号跨设备／跨应用的消费限额。

多账号按独立会话依次处理，单次默认最多 2 个、最长约 165 秒。需每天覆盖多个账号时，建议按账号 id 分别安排间隔至少 4 分钟的 cron；详见 README。未完成项目不会伪报成功。

原升级预估会尝试全局年费档或观测差值，可能不代表该账号实际订阅和增速。本版显示可靠门槛及成长值；仅配置 dailyGrowth 时计算约数，今天重复执行所得任务奖励为 0，因此估算可能变化。没有门槛或增速就不给确定天数。

## 验证结论

完成 JS 语法检查、模块引用检查和 43 项离线场景测试，测试结果见 `test-report.txt`。这些测试证明实现与模拟协议预期一致，不证明百度接口当前接受该账号，也不证明目标 iOS App 会携带可捕获 Cookie。

待用户实机验收：模块被 Surge 接受、实际 App 捕获、登录状态、未签到日收益、重复运行、锁屏定时通知、Cookie 更新。测试时不需要把真实 Cookie 发给作者或上传到本包。

