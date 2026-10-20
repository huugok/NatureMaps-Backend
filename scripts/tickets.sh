#!/usr/bin/env bash
# Tickets en GitHub Issues con relaciones nativas: bloqueos y sub-issues.
#
# Uso:
#   scripts/tickets.sh create "Titulo" ["Cuerpo"] [label]
#   scripts/tickets.sh link   <hijo> <bloqueante>...
#   scripts/tickets.sh unlink <hijo> <bloqueante>...
#   scripts/tickets.sh parent <hijo> <padre>
#   scripts/tickets.sh show   <numero>
#
# gh (https://cli.github.com) debe estar autenticado con permiso de escritura.
# GH_REPO=owner/name permite operar sobre otro repo desde fuera de un clon.
set -euo pipefail

repo="${GH_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
api="repos/$repo"

dbid() { gh api "$api/issues/$1" --jq .id; }

case "${1:-}" in
  create)
    title="${2:?falta el titulo}"
    body="${3:-_(sin descripcion)_}"
    label="${4:-ready-for-agent}"
    gh issue create --repo "$repo" --title "$title" --body "$body" --label "$label"
    ;;
  link)
    child="${2:?falta el issue hijo}"
    shift 2
    for blocker in "$@"; do
      gh api -X POST "$api/issues/$child/dependencies/blocked_by" \
        -F issue_id="$(dbid "$blocker")" >/dev/null
      echo "#$child bloqueado por #$blocker"
    done
    ;;
  unlink)
    child="${2:?falta el issue hijo}"
    shift 2
    for blocker in "$@"; do
      gh api -X DELETE "$api/issues/$child/dependencies/blocked_by/$(dbid "$blocker")" >/dev/null
      echo "#$child ya no esta bloqueado por #$blocker"
    done
    ;;
  parent)
    child="${2:?falta el issue hijo}"
    parent="${3:?falta el issue padre}"
    gh api -X POST "$api/issues/$parent/sub_issues" \
      -F sub_issue_id="$(dbid "$child")" >/dev/null
    echo "#$child es ahora sub-issue de #$parent"
    ;;
  show)
    n="${2:?falta el numero de issue}"
    gh api "$api/issues/$n" \
      --jq '"#\(.number) [\(.state)] \(.title)\nlabels: \(if (.labels|length) == 0 then "-" else (.labels|map(.name)|join(", ")) end)"'
    gh api "$api/issues/$n/dependencies/blocked_by" \
      --jq '"bloqueado por: " + (if length == 0 then "-" else (map("#\(.number) \(.title)")|join(" | ")) end)'
    gh api "$api/issues/$n/dependencies/blocking" \
      --jq '"bloquea a: " + (if length == 0 then "-" else (map("#\(.number) \(.title)")|join(" | ")) end)'
    gh api "$api/issues/$n/sub_issues" \
      --jq '"sub-issues: " + (if length == 0 then "-" else (map("#\(.number) \(.title)")|join(" | ")) end)'
    ;;
  *)
    sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
