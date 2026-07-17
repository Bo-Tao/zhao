const passthroughCommands =
  'init|setup|scan|tag|list|info|edit|config|doctor|browse|ci|open|sync'

const zshWrapper = `export ZHAO_SHELL_WRAPPED=1
zhao() {
  case "$1" in
    ${passthroughCommands})
      command zhao "$@"
      return
      ;;
  esac

  local use_print=0
  local use_claude=0
  local use_codex=0
  local use_tmux=0
  local -a args
  local arg
  for arg in "$@"; do
    case "$arg" in
      -h|--help|-v|--version)
        command zhao "$@"
        return
        ;;
      -p|--print) use_print=1 ;;
      -cc|--claude) use_claude=1 ;;
      -cdx|--codex) use_codex=1 ;;
      -t|--tmux) use_tmux=1 ;;
      *) args+=("$arg") ;;
    esac
  done

  if [[ "$use_claude" -eq 1 && "$use_codex" -eq 1 ]]; then
    printf '%s\n' '错误：--claude/-cc 与 --codex/-cdx 不能同时使用。' >&2
    return 2
  fi

  local dir
  dir="$(command zhao --print "\${args[@]}")" || return
  [[ -z "$dir" ]] && return

  if [[ "$use_print" -eq 1 ]]; then
    printf '%s\n' "$dir"
    return
  fi

  if [[ "$use_tmux" -eq 1 ]]; then
    tmux new-window -c "$dir"
    return
  fi

  cd "$dir" || return
  if [[ "$use_claude" -eq 1 ]]; then
    command claude
  elif [[ "$use_codex" -eq 1 ]]; then
    command codex
  fi
}`

const bashWrapper = `export ZHAO_SHELL_WRAPPED=1
zhao() {
  case "$1" in
    ${passthroughCommands})
      command zhao "$@"
      return
      ;;
  esac

  local use_print=0
  local use_claude=0
  local use_codex=0
  local use_tmux=0
  local -a args=()
  local arg
  for arg in "$@"; do
    case "$arg" in
      -h|--help|-v|--version)
        command zhao "$@"
        return
        ;;
      -p|--print) use_print=1 ;;
      -cc|--claude) use_claude=1 ;;
      -cdx|--codex) use_codex=1 ;;
      -t|--tmux) use_tmux=1 ;;
      *) args+=("$arg") ;;
    esac
  done

  if [[ "$use_claude" -eq 1 && "$use_codex" -eq 1 ]]; then
    printf '%s\n' '错误：--claude/-cc 与 --codex/-cdx 不能同时使用。' >&2
    return 2
  fi

  local dir
  dir="$(command zhao --print "\${args[@]}")" || return
  [[ -z "$dir" ]] && return

  if [[ "$use_print" -eq 1 ]]; then
    printf '%s\n' "$dir"
    return
  fi

  if [[ "$use_tmux" -eq 1 ]]; then
    tmux new-window -c "$dir"
    return
  fi

  cd "$dir" || return
  if [[ "$use_claude" -eq 1 ]]; then
    command claude
  elif [[ "$use_codex" -eq 1 ]]; then
    command codex
  fi
}`

export const getShellWrapper = (shell: string): string => {
  if (shell === 'zsh') {
    return zshWrapper
  }
  if (shell === 'bash') {
    return bashWrapper
  }
  throw new Error(`不支持 ${shell}，仅支持 zsh、bash`)
}
