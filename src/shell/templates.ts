const passthroughCommands =
  "init|setup|scan|tag|list|info|edit|config|doctor|browse|ci|open|sync";

const zshWrapper = `export ZHAO_SHELL_WRAPPED=1
zhao() {
  case "$1" in
    ${passthroughCommands})
      command zhao "$@"
      return
      ;;
  esac

  local use_claude=0
  local use_tmux=0
  local -a args
  local arg
  for arg in "$@"; do
    case "$arg" in
      --claude) use_claude=1 ;;
      --tmux) use_tmux=1 ;;
      --print) ;;
      *) args+=("$arg") ;;
    esac
  done

  local dir
  dir="$(command zhao --print "\${args[@]}")" || return
  [[ -z "$dir" ]] && return

  if [[ "$use_tmux" -eq 1 ]]; then
    tmux new-window -c "$dir"
    return
  fi

  cd "$dir" || return
  if [[ "$use_claude" -eq 1 ]]; then
    command claude
  fi
}`;

const bashWrapper = `export ZHAO_SHELL_WRAPPED=1
zhao() {
  case "$1" in
    ${passthroughCommands})
      command zhao "$@"
      return
      ;;
  esac

  local use_claude=0
  local use_tmux=0
  local -a args=()
  local arg
  for arg in "$@"; do
    case "$arg" in
      --claude) use_claude=1 ;;
      --tmux) use_tmux=1 ;;
      --print) ;;
      *) args+=("$arg") ;;
    esac
  done

  local dir
  dir="$(command zhao --print "\${args[@]}")" || return
  [[ -z "$dir" ]] && return

  if [[ "$use_tmux" -eq 1 ]]; then
    tmux new-window -c "$dir"
    return
  fi

  cd "$dir" || return
  if [[ "$use_claude" -eq 1 ]]; then
    command claude
  fi
}`;

export const getShellWrapper = (shell: string): string => {
  if (shell === "zsh") {
    return zshWrapper;
  }
  if (shell === "bash") {
    return bashWrapper;
  }
  throw new Error(`不支持 ${shell}，仅支持 zsh、bash`);
};
