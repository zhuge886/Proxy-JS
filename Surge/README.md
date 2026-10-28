# 百度网盘每日签到：Surge iOS 模块

模块地址：

```text
https://raw.githubusercontent.com/zhuge886/Proxy-JS/main/Surge/baidu-netdisk.sgmodule
```

在 Surge 的模块管理中通过 URL 安装并启用。模块引用同目录下的公开 JavaScript 原始文件，无需手动放置脚本。需要 Surge iOS 5.9 或更高版本。每天 08:30 按设备本地时区执行；允许 Surge 通知以接收结果。

首次使用须在 Surge 开启 MITM，安装并在 iOS 信任其 CA 证书，确保 `pan.baidu.com` 没被排除。模块只追加域名，不能代替证书安装。打开已登录的百度网盘 App，进入会员／签到页面：保存 Cookie 后模块会自动启动当天检查与签到，完成时发送结果通知；已签到的项目显示已签到。当天已通过自动获取流程运行过的账号不会再由当天的每日任务重复运行，次日 08:30 继续。无需手动运行脚本。

捕获后会尝试立即启动独立任务，App 的请求最多等待约 1 秒；若启动失败或已有任务在运行，`Baidu-Pending` 每 6 分钟检查一次待处理队列。此备用定时器不主动唤醒 iOS，系统暂停 Surge 时可能延迟，待下次运行时继续；每日任务仍在 08:30 尝试唤醒。已经安装旧版的用户请在 Surge 中更新模块和外部脚本；新版脚本使用带版本参数的地址以刷新缓存。升级后再次打开网盘 App，即使 Cookie 未改变，也会排队自动运行一次。

捕获基于网盘请求的 Cookie 头或 URL 中的 BDUSS/STOKEN，必须有经过 Surge、可解密、符合模块规则的请求。某些 App 版本可能不发送此类请求，或使用证书固定导致无法解密；此时请尝试 App 内的会员 H5 页面。保存通知仅表示已保存，自动签到结果由之后的单独通知报告。证书固定不是本模块能自动解决的。

默认启用成长值签到、每日答题、PC 积分、会员信息查询和任务中心网页端尝试，并发送通知；补签默认关闭。任务中心的 App 通道还需要本账号、同设备实际获得的 sofire `z`、设备参数和 STOKEN。Surge 不能凭 Cookie 自行生成 `z`，未配置时该通道会跳过；不能保证网页端或其他接口被百度接受。iOS 调度、网络或登录失效也可能导致漏签。

本仓库的 `baidu-netdisk-config.js` 是公开示例，不包含用户凭据。默认自动捕获单账号无需手动配置。如需多账号、补签或清除数据，请将该脚本保存到自己的 Surge 配置目录，编辑本地副本，再在个人配置中添加指向本地副本的 `type=generic` 脚本并手动运行；不要把填写 Cookie 的文件提交到公开仓库。脚本内有配置结构和操作说明。`merge` 按 id 合并，自动获取账号 id 为 `captured`；`clear` 清除本模块数据，停用模块可防止重新捕获。

默认每次处理最多 2 个账号；超出数量会在后续触发轮流处理。为保证各账号每天获得独立运行机会，应给每个账号 id 设置错开的定时任务，例如：

```ini
[Script]
Baidu-Account1 = type=cron,cronexp="30 8 * * *",wake-system=true,script-path=https://raw.githubusercontent.com/zhuge886/Proxy-JS/main/Surge/baidu-netdisk.js,timeout=180,argument=mode=run&account=manual1
Baidu-Account2 = type=cron,cronexp="35 8 * * *",wake-system=true,script-path=https://raw.githubusercontent.com/zhuge886/Proxy-JS/main/Surge/baidu-netdisk.js,timeout=180,argument=mode=run&account=manual2
```

停用原 `Baidu-Daily` 可避免重复运行，账号 ID 需与实际配置一致。Cookie 保存在 Surge 的持久存储中；脚本日志不输出凭据，但 Surge 请求查看器仍可能记录请求，请勿公开抓包。

脚本基于 [xvkong233/qlscript 的 baidu_netdisk.py](https://github.com/xvkong233/qlscript/blob/91150efc89baec0a857203555b964502fafa58e7/baidu_netdisk.py) 的接口流程移植；更多细节见 [ANALYSIS.md](ANALYSIS.md)。43 项离线模拟测试通过，自动启动和百度接口尚未在实际 iPhone 和百度账号上验证。验收时请检查实际签到状态，已签到日的结果不能证明未签到日提交成功。

