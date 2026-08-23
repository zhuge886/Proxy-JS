/**
 * Sub-Store 内联节点 -> Clash Verge Rev / Mihomo 完整分流脚本
 *
 * 基于 Semporia Clash Verge 配置的策略组和远程规则集逻辑，
 * 适配 Sub-Store 直接输出的 proxies，无需再配置 proxy-providers。
 * 服务分流规则由 Mihomo 定时从作者仓库更新；广告、AI、进程、
 * 专用域名/IP 和局域网规则保留在本脚本中。
 */

// ==================== 用户开关 ====================

const MAX_AUTO_RATIO = 3
const REGION_AUTO_TEST = true

// 沿用参考配置的轻量 HTTP 204 和 15 分钟惰性测速。
const AUTO_TEST_URL = 'http://www.gstatic.com/generate_204'
const AUTO_TEST_INTERVAL = 900
const AUTO_TEST_TIMEOUT = 5000
const AUTO_TEST_TOLERANCE = 0
const AUTO_TEST_LAZY = true

const RULE_PROVIDER_INTERVAL = 28800
const ENABLE_STRONG_ADBLOCK = true

// 参考配置的 DNS 本身为 enable: false。
// 这里同样不接管 DNS，避免影响 Clash Verge Rev 当前网络。
const DISABLE_PROFILE_DNS = true

// ==================== 策略组名称 ====================

const G = {
  main: '🚀 节点选择',
  auto: '♻️ Auto',
  fallback: '🛟 故障转移',
  balance: '⚖️ 负载均衡',
  ads: '🛑 广告拦截',
  ai: '🤖 国外 AI',
  tencent: 'Tencent',
  tencentVideo: 'TencentVideo',
  wechat: 'WeChat',
  apple: 'Apple',
  amazon: 'Amazon',
  dingTalk: 'DingTalk',
  facebook: 'Facebook',
  github: 'GitHub',
  google: 'Google',
  microsoft: 'Microsoft',
  netflix: 'Netflix',
  netease: 'NetEase',
  spotify: 'Spotify',
  steam: 'Steam',
  telegram: 'Telegram',
  twitter: 'Twitter',
  youtube: 'YouTube',
  line: 'Line',
  whatsapp: 'WhatsApp',
  paypal: 'PayPal',
  zoom: 'Zoom',
  adobe: 'Adobe',
  china: 'China',
  chinaIP: 'ChinaIP',
  global: 'Global',
  match: 'MATCH',

  otherNodes: '🌐 其他节点',
}

const REGION_NAME = {
  hk: '🇭🇰 香港节点',
  tw: '🇹🇼 台湾节点',
  jp: '🇯🇵 日本节点',
  sg: '🇸🇬 新加坡节点',
  us: '🇺🇸 美国节点',
}

const REGIONS = [
  // 只单列高频地区；其他国家和无法识别地区统一进入“其他节点”。
  {
    name: REGION_NAME.hk,
    regex: /(?:🇭🇰|香港|Hong\s?Kong|(?:^|[^A-Za-z])HK(?:\d|[^A-Za-z]|$))/i,
  },
  {
    name: REGION_NAME.tw,
    regex: /(?:🇹🇼|台湾|台灣|台北|臺北|Taiwan|Taipei|(?:^|[^A-Za-z])TW(?:\d|[^A-Za-z]|$))/i,
  },
  {
    name: REGION_NAME.jp,
    regex: /(?:🇯🇵|日本|东京|東京|大阪|Japan|Tokyo|Osaka|(?:^|[^A-Za-z])JP(?:\d|[^A-Za-z]|$))/i,
  },
  {
    name: REGION_NAME.sg,
    regex: /(?:🇸🇬|新加坡|狮城|獅城|Singapore|(?:^|[^A-Za-z])SG(?:\d|[^A-Za-z]|$))/i,
  },
  {
    name: REGION_NAME.us,
    regex: /(?:🇺🇸|美国|美國|United\s?States|American|Los\s?Angeles|San\s?Jose|Seattle|Dallas|New\s?York|(?:^|[^A-Za-z])US(?:\d|[^A-Za-z]|$))/i,
  },
]

// ==================== 图标 ====================

const ICON_BASE = 'https://raw.githubusercontent.com/Semporia/Hand-Painted-icon/master'

const ICON = {
  tencent: `${ICON_BASE}/Universal/Tencent.png`,
  tencentVideo: `${ICON_BASE}/Universal/TencentVideo.png`,
  wechat: `${ICON_BASE}/Universal/WeChat.png`,
  apple: `${ICON_BASE}/Social_Media/Apple.png`,
  amazon: `${ICON_BASE}/Social_Media/Amazon.png`,
  dingTalk: `${ICON_BASE}/Universal/DingTalk.png`,
  facebook: `${ICON_BASE}/Social_Media/Facebook.png`,
  github: `${ICON_BASE}/Social_Media/GitHub.png`,
  google: `${ICON_BASE}/Google_Suite/Google.png`,
  microsoft: `${ICON_BASE}/Universal/Microsoft.png`,
  netflix: `${ICON_BASE}/Universal/Netflix.png`,
  netease: `${ICON_BASE}/Universal/NetEase.png`,
  spotify: `${ICON_BASE}/Social_Media/Spotify.png`,
  steam: `${ICON_BASE}/Universal/TencentVideo.png`,
  telegram: `${ICON_BASE}/Social_Media/Telegram.png`,
  twitter: `${ICON_BASE}/Social_Media/Twitter.png`,
  youtube: `${ICON_BASE}/Google_Suite/YouTube.png`,
  line: `${ICON_BASE}/Social_Media/Line.png`,
  whatsapp: `${ICON_BASE}/Social_Media/WhatsApp.png`,
  paypal: `${ICON_BASE}/Social_Media/Paypal.png`,
  zoom: `${ICON_BASE}/Universal/Zoom.png`,
}

// ==================== 工具函数 ====================

function nodeRatio(name) {
  const text = String(name || '')

  const ratioPrefix = text.match(/倍率\s*[:：]?\s*(\d+(?:\.\d+)?)/i)
  if (ratioPrefix) return Number(ratioPrefix[1])

  const xPrefix = text.match(
    /(?:^|[\s_\-|])(?:x|×)\s*(\d+(?:\.\d+)?)(?=$|[\s_\-|])/i,
  )
  if (xPrefix) return Number(xPrefix[1])

  const xSuffix = text.match(
    /(?:^|[\s_\-|])(\d+(?:\.\d+)?)\s*(?:x|×)(?=$|[\s_\-|])/i,
  )
  return xSuffix ? Number(xSuffix[1]) : 1
}

function isAutoCandidate(name) {
  return MAX_AUTO_RATIO <= 0 || nodeRatio(name) <= MAX_AUTO_RATIO
}

function selectGroup(name, proxies, extra = {}) {
  return {
    name,
    type: 'select',
    proxies: [...new Set(proxies)],
    ...extra,
  }
}

function healthGroup(name, type, proxies, extra = {}) {
  return {
    name,
    type,
    proxies: [...new Set(proxies)],
    url: AUTO_TEST_URL,
    interval: AUTO_TEST_INTERVAL,
    timeout: AUTO_TEST_TIMEOUT,
    lazy: true,
    ...extra,
  }
}

function preferredChoices(regionNames, preferredRegion, fallback, allChoices) {
  const first = regionNames.includes(preferredRegion)
    ? [preferredRegion]
    : fallback

  return [
    ...first,
    ...allChoices.filter((name) => !first.includes(name)),
  ]
}

function classicalProvider(name) {
  return {
    type: 'http',
    behavior: 'classical',
    interval: RULE_PROVIDER_INTERVAL,
    path: `./ruleset/semporia/${name}.yaml`,
    url: `https://cdn.jsdelivr.net/gh/Semporia/Clash@master/Rule/${name}.yaml`,
  }
}

function buildRuleProviders() {
  const names = [
    'Adobe',
    'Apple',
    'Amazon',
    'China',
    'DingTalk',
    'Facebook',
    'GitHub',
    'Google',
    'Microsoft',
    'Netflix',
    'NetEase',
    'Spotify',
    'Steam',
    'Telegram',
    'Twitter',
    'Tencent',
    'TencentVideo',
    'YouTube',
    'WhatsApp',
    'Line',
    'WeChat',
    'PayPal',
    'Zoom',
    'Proxy',
  ]

  const providers = Object.fromEntries(
    names.map((name) => [name, classicalProvider(name)]),
  )

  providers.ChinaIP = {
    type: 'http',
    behavior: 'ipcidr',
    interval: RULE_PROVIDER_INTERVAL,
    path: './ruleset/semporia/ChinaIP.yaml',
    url: 'https://cdn.jsdelivr.net/gh/soffchen/GeoIP2-CN@release/clash-rule-provider.yml',
  }

  return providers
}

// ==================== 主入口 ====================

function main(config) {
  config.proxies = Array.isArray(config.proxies) ? config.proxies : []

  if (config.proxies.length === 0) {
    throw new Error('订阅中没有可用代理节点，请确认 Sub-Store 输出目标为 ClashMeta')
  }

  const unnamedNodeIndex = config.proxies.findIndex(
    (proxy) => typeof proxy?.name !== 'string' || !proxy.name.trim(),
  )
  if (unnamedNodeIndex !== -1) {
    throw new Error(`第 ${unnamedNodeIndex + 1} 个节点缺少有效名称`)
  }

  // Sub-Store 已负责去重和命名，脚本不再修改节点名。
  const allNodes = config.proxies.map((proxy) => proxy.name)
  const autoNodes = allNodes.filter(isAutoCandidate)
  const testedNodes = autoNodes.length > 0 ? autoNodes : allNodes

  const regionGroups = []
  const regionNames = []
  const matchedNodes = new Set()

  for (const region of REGIONS) {
    const nodes = allNodes.filter((name) => region.regex.test(name))
    if (nodes.length === 0) continue

    nodes.forEach((name) => matchedNodes.add(name))
    regionNames.push(region.name)

    const regionAutoNodes = nodes.filter(isAutoCandidate)
    const regionCandidates = regionAutoNodes.length > 0 ? regionAutoNodes : nodes

    regionGroups.push(
      REGION_AUTO_TEST
        ? healthGroup(region.name, 'url-test', regionCandidates, {
            tolerance: AUTO_TEST_TOLERANCE,
            lazy: true,
          })
        : selectGroup(region.name, nodes),
    )
  }

  const otherNodes = allNodes.filter((name) => !matchedNodes.has(name))
  if (otherNodes.length > 0) regionNames.push(G.otherNodes)

  const allManualChoices = [
    G.main,
    G.auto,
    ...regionNames,
    'DIRECT',
  ]

  const usChoices = preferredChoices(
    regionNames,
    REGION_NAME.us,
    [G.auto, G.main],
    allManualChoices,
  )

  const sgChoices = preferredChoices(
    regionNames,
    REGION_NAME.sg,
    ['DIRECT', G.auto, G.main],
    allManualChoices,
  )

  const jpChoices = preferredChoices(
    regionNames,
    REGION_NAME.jp,
    [G.auto, G.main],
    allManualChoices,
  )

  // 国外 AI 默认优先美国，其次新加坡、日本，再提供其他可用地区。
  const aiPreferred = [REGION_NAME.us, REGION_NAME.sg, REGION_NAME.jp]
    .filter((name) => regionNames.includes(name))
  const aiChoices = [
    ...aiPreferred,
    G.auto,
    G.main,
    ...regionNames.filter((name) => !aiPreferred.includes(name)),
    'DIRECT',
  ]

  const groups = [
    selectGroup(G.main, [
      G.auto,
      G.fallback,
      G.balance,
      ...regionNames,
      ...allNodes,
      'DIRECT',
    ]),

    healthGroup(G.auto, 'url-test', testedNodes, {
      tolerance: AUTO_TEST_TOLERANCE,
      lazy: AUTO_TEST_LAZY,
    }),

    healthGroup(G.fallback, 'fallback', testedNodes),

    healthGroup(G.balance, 'load-balance', testedNodes, {
      strategy: 'consistent-hashing',
    }),

    // Semporia 服务分组：保留原默认顺序，同时增加安全回退选项。
    selectGroup(G.tencent, ['DIRECT', ...sgChoices.filter((name) => name !== 'DIRECT')], {
      icon: ICON.tencent,
    }),
    selectGroup(G.tencentVideo, ['DIRECT', G.main, G.auto], {
      icon: ICON.tencentVideo,
    }),
    selectGroup(G.wechat, [G.tencent, 'DIRECT', G.main], {
      icon: ICON.wechat,
    }),
    selectGroup(G.apple, usChoices, { icon: ICON.apple }),
    selectGroup(G.amazon, usChoices, { icon: ICON.amazon }),
    selectGroup(G.dingTalk, usChoices, { icon: ICON.dingTalk }),
    selectGroup(G.facebook, usChoices, { icon: ICON.facebook }),
    selectGroup(G.github, usChoices, { icon: ICON.github }),
    selectGroup(G.google, usChoices, { icon: ICON.google }),
    selectGroup(G.microsoft, usChoices, { icon: ICON.microsoft }),
    selectGroup(G.netflix, usChoices, { icon: ICON.netflix }),
    selectGroup(G.netease, ['DIRECT', G.main, G.auto], { icon: ICON.netease }),
    selectGroup(G.spotify, usChoices, { icon: ICON.spotify }),
    selectGroup(G.steam, ['DIRECT', G.main, G.auto], { icon: ICON.steam }),
    selectGroup(G.telegram, usChoices, { icon: ICON.telegram }),
    selectGroup(G.twitter, usChoices, { icon: ICON.twitter }),
    selectGroup(G.youtube, usChoices, { icon: ICON.youtube }),
    selectGroup(G.line, jpChoices, { icon: ICON.line }),
    selectGroup(G.whatsapp, usChoices, { icon: ICON.whatsapp }),
    selectGroup(G.paypal, usChoices, { icon: ICON.paypal }),
    selectGroup(G.zoom, ['DIRECT', G.main, G.auto], { icon: ICON.zoom }),

    selectGroup(G.adobe, ['REJECT', 'DIRECT']),
    selectGroup(G.china, ['DIRECT', G.main, G.auto]),
    selectGroup(G.chinaIP, ['DIRECT', G.main, G.auto]),
    selectGroup(G.global, [G.auto, G.main, ...regionNames, 'DIRECT']),
    selectGroup(G.match, [G.auto, G.main, 'DIRECT', ...regionNames]),
    selectGroup(G.ads, ['REJECT', 'DIRECT']),
    selectGroup(G.ai, aiChoices),

    ...regionGroups,
  ]

  if (otherNodes.length > 0) {
    groups.push(selectGroup(G.otherNodes, otherNodes))
  }

  // 专用直连规则：保留作者配置中的域名和 IP 逻辑。
  const rules = [
    'IP-CIDR,113.108.0.112/32,DIRECT,no-resolve',
    'DOMAIN-SUFFIX,prodigal4936.com,DIRECT',
    'DOMAIN-SUFFIX,immtele.com,DIRECT',
    'DOMAIN-REGEX,^tag.*\\.pro$,DIRECT',
    'DOMAIN-REGEX,^tag.*\\.vip$,DIRECT',

    // Windows 进程分流。
    `PROCESS-NAME,Telegram.exe,${G.telegram}`,
    `PROCESS-NAME,QiDian.exe,${G.tencent}`,
    `PROCESS-NAME,WeChatAppEx.exe,${G.wechat}`,
    `PROCESS-NAME,LINE.exe,${G.line}`,
    `PROCESS-NAME,LineCall.exe,${G.line}`,
    `PROCESS-NAME,LineMediaPlayer.exe,${G.line}`,
    `PROCESS-NAME,Weixin.exe,${G.wechat}`,
    `PROCESS-NAME,WXWork.exe,${G.wechat}`,
    `PROCESS-NAME,WXWorkWeb.exe,${G.wechat}`,
    `PROCESS-NAME,WXDrive_x64.exe,${G.wechat}`,
    'PROCESS-NAME,XChains.Client.exe,DIRECT',

    // 广告与国外 AI 必须先于通用服务规则匹配。
    ...(ENABLE_STRONG_ADBLOCK ? [`RULE-SET,adblock_mihomo,${G.ads}`] : []),
    `GEOSITE,category-ads-all,${G.ads}`,
    `GEOSITE,openai,${G.ai}`,
    `GEOSITE,category-ai-!cn,${G.ai}`,

    // Semporia 规则内容全部通过远程 rule-provider 更新。
    `RULE-SET,Adobe,${G.adobe}`,
    `RULE-SET,Apple,${G.apple}`,
    `RULE-SET,Amazon,${G.amazon}`,
    `RULE-SET,DingTalk,${G.dingTalk}`,
    `RULE-SET,Facebook,${G.facebook}`,
    `RULE-SET,GitHub,${G.github}`,
    `RULE-SET,Google,${G.google}`,
    `RULE-SET,Microsoft,${G.microsoft}`,
    `RULE-SET,Netflix,${G.netflix}`,
    `RULE-SET,NetEase,${G.netease}`,
    `RULE-SET,Spotify,${G.spotify}`,
    `RULE-SET,Steam,${G.steam}`,
    `RULE-SET,Telegram,${G.telegram}`,
    `RULE-SET,Twitter,${G.twitter}`,
    `RULE-SET,Tencent,${G.tencent}`,
    `RULE-SET,TencentVideo,${G.tencentVideo}`,
    `RULE-SET,YouTube,${G.youtube}`,
    `RULE-SET,WhatsApp,${G.whatsapp}`,
    `RULE-SET,Line,${G.line}`,
    `RULE-SET,WeChat,${G.wechat}`,
    `RULE-SET,PayPal,${G.paypal}`,
    `RULE-SET,Zoom,${G.zoom}`,
    `RULE-SET,China,${G.china}`,
    `RULE-SET,ChinaIP,${G.chinaIP}`,

    // 局域网与作者配置中的专用直连目标。
    'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
    'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
    'IP-CIDR,172.16.0.0/12,DIRECT,no-resolve',
    'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
    'IP-CIDR,100.64.0.0/10,DIRECT,no-resolve',
    'IP-CIDR,224.0.0.0/4,DIRECT,no-resolve',
    'IP-CIDR,8.218.42.178/32,DIRECT,no-resolve',
    'IP-CIDR,119.28.28.28/32,DIRECT,no-resolve',
    'IP-CIDR,182.254.116.0/24,DIRECT,no-resolve',
    'DOMAIN,haven.scm.eportyun.com,DIRECT',

    `RULE-SET,Proxy,${G.global}`,
    `GEOIP,CN,${G.chinaIP},no-resolve`,
    `MATCH,${G.match}`,
  ]

  config.mode = 'rule'
  config['unified-delay'] = true
  config['tcp-concurrent'] = true
  config['global-client-fingerprint'] = 'chrome'
  config['find-process-mode'] = 'strict'

  config.profile = {
    ...(config.profile || {}),
    'store-selected': false,
  }

  // 保留参考配置的 hosts 记录，同时不覆盖用户已有条目。
  config.hosts = {
    'mtalk.google.com': '108.177.125.188',
    ...(config.hosts || {}),
  }

  if (DISABLE_PROFILE_DNS) {
    config.dns = {
      ...(config.dns || {}),
      enable: false,
    }
  }

  // GEOSITE/GEOIP 规则所需数据库，使用 Mihomo 官方规则数据。
  config['geodata-mode'] = true
  config['geodata-loader'] = 'memconservative'
  config['geo-auto-update'] = true
  config['geo-update-interval'] = 24
  config['geox-url'] = {
    geoip: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat',
    geosite: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat',
    mmdb: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb',
    asn: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb',
  }

  config['rule-providers'] = {
    ...(config['rule-providers'] || {}),
    ...buildRuleProviders(),
  }

  if (ENABLE_STRONG_ADBLOCK) {
    config['rule-providers'].adblock_mihomo = {
      type: 'http',
      behavior: 'domain',
      format: 'mrs',
      interval: RULE_PROVIDER_INTERVAL,
      path: './ruleset/adblockfilters/adblockmihomo.mrs',
      url: 'https://gcore.jsdelivr.net/gh/217heidai/adblockfilters@main/rules/adblockmihomo.mrs',
    }
  }

  config['proxy-groups'] = groups
  config.rules = rules

  return config
}
