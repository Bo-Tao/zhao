import { openInEditor } from '../core/editor.js'
import { getStorePaths, loadConfig, saveConfig } from '../core/store.js'
import type { ZhaoConfig } from '../core/types.js'
import { ensureOnboarded } from '../middleware/onboard.js'
import type { DefineCommand } from './types.js'

type ConfigKey =
  | 'scanRoots'
  | 'useFzf'
  | 'scanDepth'
  | 'ciTemplates.test'
  | 'ciTemplates.prod'

const configKeys = new Set<ConfigKey>([
  'scanRoots',
  'useFzf',
  'scanDepth',
  'ciTemplates.test',
  'ciTemplates.prod',
])

type ConfigInvocation =
  | { action: 'edit' }
  | { action: 'get'; key: string }
  | { action: 'set'; key: string; value: string }

export const parseConfigPositionals = (
  positionals: string[],
): ConfigInvocation => {
  if (positionals.length === 0) {
    return { action: 'edit' }
  }
  const [action, key, value, ...extra] = positionals
  if (action !== 'get' && action !== 'set') {
    throw new Error('config 仅支持 get、set；无参数时打开配置文件。')
  }
  if (!key || (action === 'get' && (value !== undefined || extra.length))) {
    throw new Error('用法：zhao config get <key>')
  }
  if (action === 'set') {
    if (value === undefined || extra.length > 0) {
      throw new Error('用法：zhao config set <key> <value>')
    }
    return { action, key, value }
  }
  return { action, key }
}

const validateKey = (key: string): ConfigKey => {
  if (!configKeys.has(key as ConfigKey)) {
    throw new Error(
      `不支持的配置键 ${key}。可用键：${[...configKeys].join('、')}`,
    )
  }
  return key as ConfigKey
}

export const getConfigValue = (
  config: ZhaoConfig,
  rawKey: string,
): string | number | boolean | string[] => {
  const key = validateKey(rawKey)
  const value =
    key === 'ciTemplates.test'
      ? config.ciTemplates?.test
      : key === 'ciTemplates.prod'
        ? config.ciTemplates?.prod
        : config[key]
  if (value === undefined) {
    throw new Error(`配置键 ${key} 尚未设置。`)
  }
  return value
}

export const setConfigValue = (
  config: ZhaoConfig,
  rawKey: string,
  rawValue: string,
): ZhaoConfig => {
  const key = validateKey(rawKey)
  if (key === 'scanRoots') {
    const scanRoots = rawValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    if (scanRoots.length === 0) {
      throw new Error('scanRoots 至少需要一个目录。')
    }
    return { ...config, scanRoots: [...new Set(scanRoots)] }
  }
  if (key === 'useFzf') {
    if (rawValue !== 'true' && rawValue !== 'false') {
      throw new Error('useFzf 的值必须是 true 或 false。')
    }
    return { ...config, useFzf: rawValue === 'true' }
  }
  if (key === 'scanDepth') {
    const scanDepth = Number(rawValue)
    if (!Number.isInteger(scanDepth) || scanDepth < 1 || scanDepth > 10) {
      throw new Error('scanDepth 必须是 1 到 10 的整数。')
    }
    return { ...config, scanDepth }
  }
  const environment = key.endsWith('.test') ? 'test' : 'prod'
  if (!rawValue.trim()) {
    throw new Error(`${key} 不能为空。`)
  }
  return {
    ...config,
    ciTemplates: { ...config.ciTemplates, [environment]: rawValue },
  }
}

const formatConfigValue = (
  value: string | number | boolean | string[],
): string => (Array.isArray(value) ? value.join('\n') : String(value))

export default (defineCommand: DefineCommand) =>
  defineCommand({
    meta: {
      name: 'config',
      description: '读取、设置或编辑 config.yml',
    },
    args: {
      action: {
        type: 'positional',
        description: 'get 或 set',
        required: false,
      },
      key: {
        type: 'positional',
        description: '配置键',
        required: false,
      },
      value: {
        type: 'positional',
        description: '配置值',
        required: false,
      },
    },
    async run({ args }) {
      const invocation = parseConfigPositionals(args._ as string[])
      await ensureOnboarded({ ensureIndex: false, scanAfterConfig: false })
      const paths = getStorePaths()
      const config = await loadConfig(paths)
      if (!config) {
        throw new Error('config.yml 不存在，请先运行 zhao 完成首次配置。')
      }
      if (invocation.action === 'edit') {
        await openInEditor(paths.config)
        return
      }
      if (invocation.action === 'get') {
        process.stdout.write(
          `${formatConfigValue(getConfigValue(config, invocation.key))}\n`,
        )
        return
      }
      await saveConfig(
        setConfigValue(config, invocation.key, invocation.value),
        paths,
      )
      process.stderr.write(`已设置 ${invocation.key}。\n`)
    },
  })
