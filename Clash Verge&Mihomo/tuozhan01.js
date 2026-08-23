/**
 * Sub-Store 节点订阅 -> Clash Verge Rev / Mihomo 完整分流脚本
 *
 * 用途：输入配置只需包含 proxies，本脚本会自动生成策略组、地区组和规则。
 * 使用：Clash Verge Rev -> 设置 -> 配置 -> 全局扩展脚本。
 */

// ==================== 用户开关 ====================

// 自动测速时排除高倍率节点；设为 0 表示不限制。
const MAX_AUTO_RATIO = 3

// 地区组：true 自动选择低延迟；false 手动选择地区内节点。
const REGION_AUTO_TEST = true

// 自动选择组的测速参数。
const AUTO_TEST_INTERVAL = 300
const AUTO_TEST_TOLERANCE = 0
const AUTO_TEST_LAZY = false
const AUTO_TEST_URL = 'https://www.gstatic.com/generate_204'
const AUTO_TEST_TIMEOUT = 5000

// 除 Mihomo 内置广告库外，再加载外部 MRS 规则。
const ENABLE_STRONG_ADBLOCK = true

// 默认不覆盖 Clash Verge Rev 当前的 DNS/TUN 设置。
const ENABLE_DNS_OVERRIDE = false
const ENABLE_TUN_OVERRIDE = false
const ENABLE_SNIFFER = true

// 左侧只写“规则类型,值”，目标策略由所在数组决定。
const CUSTOM_RULES = {
  direct: [],
  proxy: [],
  reject: [],
}

// ==================== 策略组名称 ====================

const G = {
  main: '🚀 节点选择',
  auto: '♻️ 自动选择·最低延迟',
  fallback: '🛟 故障转移',
  balance: '⚖️ 负载均衡',
  direct: '🎯 全球直连',
  china: '🇨🇳 国内网站',
  final: '🐟 漏网之鱼',
  ads: '🛑 广告拦截',
  ai: '🤖 AI 服务',
  google: '🔎 Google',
  youtube: '📺 YouTube',
  telegram: '📨 Telegram',
  github: '🐙 GitHub',
  microsoft: 'Ⓜ️ Microsoft',
  apple: '🍎 Apple',
  streaming: '🎬 国际流媒体',
  games: '🎮 游戏平台',
  download: '⬇️ 下载软件',
  otherNodes: '🌐 其他节点',
}

// ==================== 地区识别 ====================

const REGIONS = [
  {
    name: '🇭🇰 香港节点',
    regex: /(?:🇭🇰|香港|Hong\s?Kong|(?:^|[\s_\-|])HK(?:\d|[\s_\-|]|$))/i,
  },
  {
    name: '🇹🇼 台湾节点',
    regex: /(?:🇹🇼|台湾|台灣|台北|臺北|Taiwan|Taipei|(?:^|[\s_\-|])TW(?:\d|[\s_\-|]|$))/i,
  },
  {
    name: '🇯🇵 日本节点',
    regex: /(?:🇯🇵|日本|东京|東京|大阪|Japan|Tokyo|Osaka|(?:^|[\s_\-|])JP(?:\d|[\s_\-|]|$))/i,
  },
  {
    name: '🇸🇬 新加坡节点',
    regex: /(?:🇸🇬|新加坡|狮城|獅城|Singapore|(?:^|[\s_\-|])SG(?:\d|[\s_\-|]|$))/i,
  },
  {
    name: '🇺🇸 美国节点',
    regex: /(?:🇺🇸|美国|美國|United\s?States|Los\s?Angeles|San\s?Jose|Seattle|Dallas|New\s?York|(?:^|[\s_\-|])US(?:\d|[\s_\-|]|$))/i,
  },
  {
    name: '🇰🇷 韩国节点',
    regex: /(?:🇰🇷|韩国|韓國|首尔|首爾|Korea|Seoul|(?:^|[\s_\-|])KR(?:\d|[\s_\-|]|$))/i,
  },
  {
    name: '🇬🇧 英国节点',
    regex: /(?:🇬🇧|英国|英國|伦敦|倫敦|United\s?Kingdom|London|(?:^|[\s_\-|])(?:UK|GB)(?:\d|[\s_\-|]|$))/i,
  },
  {
    name: '🇩🇪 德国节点',
    regex: /(?:🇩🇪|德国|德國|法兰克福|法蘭克福|Germany|Frankfurt|(?:^|[\s_\-|])DE(?:\d|[\s_\-|]|$))/i,
  },
  {
    name: '🇨🇦 加拿大节点',
    regex: /(?:🇨🇦|加拿大|Canada|Toronto|Vancouver|(?:^|[\s_\-|])CA(?:\d|[\s_\-|]|$))/i,
  },
  {
    name: '🇦🇺 澳大利亚节点',
    regex: /(?:🇦🇺|澳大利亚|澳大利亞|澳洲|Australia|Sydney|Melbourne|(?:^|[\s_\-|])AU(?:\d|[\s_\-|]|$))/i,
  },
  {
    name: '🇫🇷 法国节点',
    regex: /(?:🇫🇷|法国|法國|France|Paris|(?:^|[\s_\-|])FR(?:\d|[\s_\-|]|$))/i,
  },
  {
    name: '🇳🇱 荷兰节点',
    regex: /(?:🇳🇱|荷兰|荷蘭|Netherlands|Amsterdam|(?:^|[\s_\-|])NL(?:\d|[\s_\-|]|$))/i,
  },
]

// ==================== 工具函数 ====================

function nodeRatio(name) {
  const text = String(name || '')

  const ratioPrefix = text.match(
    /倍率\s*[:：]?\s*(\d+(?:\.\d+)?)/i,
  )
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

function selectGroup(name, proxies) {
  return {
    name,
    type: 'select',
    proxies: [...new Set(proxies)],
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

function preferred(regionNames, first, fallback) {
  return regionNames.includes(first)
    ? [first, ...fallback, ...regionNames.filter((name) => name !== first), 'DIRECT']
    : [...fallback, ...regionNames, 'DIRECT']
}

function addTarget(rules, sourceRules, target) {
  for (const rule of sourceRules) {
    if (typeof rule === 'string' && rule.trim()) {
      rules.push(`${rule.trim()},${target}`)
    }
  }
}

// ==================== 可选高级配置 ====================

function applyDnsOverride(config) {
  config.dns = {
    enable: true,
    ipv6: false,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/16',
    'fake-ip-filter-mode': 'blacklist',
    'fake-ip-filter': [
      '*.lan',
      '*.local',
      '*.localhost',
      'time.*.com',
      'ntp.*.com',
      '+.msftconnecttest.com',
      '+.msftncsi.com',
    ],
    'default-nameserver': [
      '223.5.5.5',
      '119.29.29.29',
    ],
    nameserver: [
      'https://dns.alidns.com/dns-query',
      'https://doh.pub/dns-query',
    ],
    'proxy-server-nameserver': [
      'https://dns.alidns.com/dns-query',
      'https://doh.pub/dns-query',
    ],
    'nameserver-policy': {
      'geosite:cn,private': [
        'https://dns.alidns.com/dns-query',
        'https://doh.pub/dns-query',
      ],
      'geosite:geolocation-!cn': [
        'https://cloudflare-dns.com/dns-query',
        'https://dns.google/dns-query',
      ],
    },
  }
}

function applyTunOverride(config) {
  config.tun = {
    ...(config.tun || {}),
    enable: true,
    stack: 'mixed',
    'auto-route': true,
    'auto-redirect': true,
    'auto-detect-interface': true,
    'dns-hijack': [
      'any:53',
      'tcp://any:53',
    ],
  }
}

function applySniffer(config) {
  config.sniffer = {
    enable: true,
    'force-dns-mapping': true,
    'parse-pure-ip': true,
    'override-destination': true,
    sniff: {
      TLS: { ports: [443, 8443] },
      HTTP: { ports: [80, '8080-8880'] },
      QUIC: { ports: [443, 8443] },
    },
    'skip-domain': [
      'Mijia Cloud',
      '+.oray.com',
      '+.push.apple.com',
    ],
  }
}

// ==================== 主入口 ====================

function main(config) {
  config.proxies = Array.isArray(config.proxies) ? config.proxies : []

  if (config.proxies.length === 0) {
    throw new Error('订阅中没有可用代理节点，请确认 Sub-Store 输出目标为 ClashMeta')
  }

  // Sub-Store 负责节点命名和去重，这里不再改名。
  const unnamedNodeIndex = config.proxies.findIndex(
    (proxy) => typeof proxy?.name !== 'string' || !proxy.name.trim(),
  )
  if (unnamedNodeIndex !== -1) {
    throw new Error(`第 ${unnamedNodeIndex + 1} 个节点缺少有效名称`)
  }

  const allNodes = config.proxies.map((proxy) => proxy.name)
  const autoNodes = allNodes.filter(isAutoCandidate)
  const testedNodes = autoNodes.length > 0 ? autoNodes : allNodes

  const regionGroups = []
  const matchedNodes = new Set()

  for (const region of REGIONS) {
    const nodes = allNodes.filter((name) => region.regex.test(name))
    if (nodes.length === 0) continue

    nodes.forEach((name) => matchedNodes.add(name))

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
  const regionNames = regionGroups.map((group) => group.name)
  if (otherNodes.length > 0) regionNames.push(G.otherNodes)

  const baseChoices = [G.main, G.auto]
  const serviceChoices = [...baseChoices, ...regionNames, 'DIRECT']

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

    selectGroup(G.ai, preferred(regionNames, '🇺🇸 美国节点', baseChoices)),
    selectGroup(G.google, serviceChoices),
    selectGroup(G.youtube, serviceChoices),
    selectGroup(G.telegram, preferred(regionNames, '🇸🇬 新加坡节点', baseChoices)),
    selectGroup(G.github, serviceChoices),
    selectGroup(G.microsoft, ['DIRECT', ...serviceChoices.filter((name) => name !== 'DIRECT')]),
    selectGroup(G.apple, ['DIRECT', ...serviceChoices.filter((name) => name !== 'DIRECT')]),
    selectGroup(G.streaming, serviceChoices),
    selectGroup(G.games, ['DIRECT', ...serviceChoices.filter((name) => name !== 'DIRECT')]),
    selectGroup(G.download, ['DIRECT', G.main, G.auto, 'REJECT', ...regionNames]),
    selectGroup(G.ads, ['REJECT', 'DIRECT']),
    selectGroup(G.china, ['DIRECT', G.main, G.auto]),
    selectGroup(G.direct, ['DIRECT', G.main]),
    selectGroup(G.final, [G.main, G.auto, 'DIRECT', ...regionNames]),
    ...regionGroups,
  ]

  if (otherNodes.length > 0) {
    groups.push(selectGroup(G.otherNodes, otherNodes))
  }

  const rules = []

  addTarget(rules, CUSTOM_RULES.direct, G.direct)
  addTarget(rules, CUSTOM_RULES.proxy, G.main)
  addTarget(rules, CUSTOM_RULES.reject, G.ads)

  rules.push(
    `GEOSITE,private,${G.direct}`,
    `GEOIP,private,${G.direct},no-resolve`,
  )

  if (ENABLE_STRONG_ADBLOCK) {
    rules.push(`RULE-SET,adblock_mihomo,${G.ads}`)
  }

  rules.push(
    `GEOSITE,category-ads-all,${G.ads}`,
    `GEOSITE,openai,${G.ai}`,
    `GEOSITE,category-ai-!cn,${G.ai}`,
    `GEOSITE,youtube,${G.youtube}`,
    `GEOSITE,google,${G.google}`,
    `GEOSITE,telegram,${G.telegram}`,
    `GEOIP,telegram,${G.telegram},no-resolve`,
    `GEOSITE,github,${G.github}`,
    `GEOSITE,microsoft@cn,${G.china}`,
    `GEOSITE,microsoft,${G.microsoft}`,
    `GEOSITE,apple-cn,${G.apple}`,
    `GEOSITE,apple,${G.apple}`,
    `GEOSITE,netflix,${G.streaming}`,
    `GEOSITE,disney,${G.streaming}`,
    `GEOSITE,spotify,${G.streaming}`,
    `GEOSITE,tiktok,${G.streaming}`,
    `GEOSITE,biliintl,${G.streaming}`,
    `GEOSITE,category-games@cn,${G.china}`,
    `GEOSITE,steam@cn,${G.china}`,
    `GEOSITE,category-games,${G.games}`,
    `GEOSITE,cn,${G.china}`,
    `GEOIP,CN,${G.china},no-resolve`,
    `GEOSITE,geolocation-!cn,${G.final}`,
    `MATCH,${G.final}`,
  )

  config.mode = 'rule'
  config['unified-delay'] = true
  config['tcp-concurrent'] = true
  config['global-client-fingerprint'] = 'chrome'

  config.profile = {
    ...(config.profile || {}),

    // 不持久化 URL-Test 的手动 fixed 状态，
    // 避免自动组重载后停留在高延迟节点。
    'store-selected': false,
    'store-fake-ip': true,
  }

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

  if (ENABLE_STRONG_ADBLOCK) {
    config['rule-providers'] = {
      ...(config['rule-providers'] || {}),
      adblock_mihomo: {
        type: 'http',
        behavior: 'domain',
        format: 'mrs',
        interval: 28800,
        path: './ruleset/adblockfilters/adblockmihomo.mrs',
        url: 'https://gcore.jsdelivr.net/gh/217heidai/adblockfilters@main/rules/adblockmihomo.mrs',
      },
    }
  }

  if (ENABLE_DNS_OVERRIDE) applyDnsOverride(config)
  if (ENABLE_TUN_OVERRIDE) applyTunOverride(config)
  if (ENABLE_SNIFFER) applySniffer(config)

  config['proxy-groups'] = groups
  config.rules = rules

  return config
}
