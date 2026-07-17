export interface ParsedGitRemote {
  host: string
  path: string
}

const trimGitSuffix = (value: string): string =>
  value.replace(/\/+$/, '').replace(/\.git$/i, '')

export const parseGitRemote = (remote: string): ParsedGitRemote => {
  const value = remote.trim()

  const scpMatch = value.match(
    /^(?:[^@\s]+@)?(?<host>[^:/\s]+):(?<path>[^/\s].+)$/,
  )
  const scpHost = scpMatch?.groups?.host
  const scpPath = scpMatch?.groups?.path
  if (scpHost && scpPath) {
    return {
      host: scpHost.toLowerCase(),
      path: trimGitSuffix(scpPath),
    }
  }

  try {
    const url = new URL(value)
    if (!['http:', 'https:', 'ssh:', 'git:'].includes(url.protocol)) {
      throw new Error('unsupported protocol')
    }
    const path = trimGitSuffix(url.pathname.replace(/^\/+/, ''))
    if (!url.hostname || !path) {
      throw new Error('missing host or path')
    }
    return {
      host: url.hostname.toLowerCase(),
      path,
    }
  } catch {
    throw new Error(`无法识别 Git remote：${remote}`)
  }
}

export const remoteToProjectId = (remote: string): string => {
  const parsed = parseGitRemote(remote)
  return `${parsed.host}/${parsed.path}`
}

export const remoteToWebUrl = (remote: string): string => {
  const parsed = parseGitRemote(remote)
  return `https://${parsed.host}/${parsed.path}`
}

export const getRemoteGroup = (remote: string): string => {
  const { path } = parseGitRemote(remote)
  const segments = path.split('/')
  segments.pop()
  return segments.join('/')
}
