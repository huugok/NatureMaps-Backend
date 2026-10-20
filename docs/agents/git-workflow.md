# Flujo de trabajo con Git

Reglas de ramas, PRs y versionado de este repositorio. Aplican igual al backend y al frontend.

## Principio

`main` es **protegida y siempre desplegable**. Nadie pushea directo, ni siquiera el dueño. Todo
cambio entra por pull request, se revisa y se mergea con squash. La historia de `main` es lineal y
legible: cada commit en `main` corresponde a una PR mergeada.

## Flujo

1. **Sincroniza** `main` antes de empezar: `git switch main && git pull --ff-only`.
2. **Crea una rama** desde `main`: `git switch -c feat/<slug>` (o `fix/`, `chore/`, `docs/`).
3. **Trabaja y commitea** en la rama. Commits pequeños, en imperativo, con prefijo
   `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
4. **Abre la PR** contra `main` en cuanto haya algo revisable (borrador permitido).
   El body explica el cambio, el porqué, cómo se probó y capturas si hay UI.
5. **Pasa los checks**: build/tipos/lint/tests del repo. La PR debe estar al día con `main`
   (rebasa o mergea `main` en tu rama antes de pedir revisión final).
6. **Revisión**: al menos una aprobación cuando haya más de una persona en el repo. En solitario,
   la PR queda como registro y se auto-mergea (GitHub no permite autoaprobarse).
7. **Merge con squash** (un commit por PR), borrar la rama remota al mergear.
8. **Cierra la issue** asociada: `Closes #<n>` en el body de la PR.

## Reglas de protección de `main`

Estado aplicado desde 2026-10-20 en ambos repos:

| Regla | Valor | Por qué |
|---|---|---|
| Require a pull request before merging | sí | nada entra sin PR |
| Required approvals | **0 hoy**; 1 cuando haya otra persona con escritura | revisión real sin bloquear en solitario |
| Dismiss stale approvals on new commits | sí | una aprobación no vale para código nuevo |
| Require conversation resolution | sí | no quedan comentarios abiertos al mergear |
| Require branches to be up to date | sí, junto a los checks | evita merges contra `main` viejo |
| Require status checks | pendiente | no hay CI todavía; activar cuando exista |
| Require linear history | sí | `main` sin merges en cascada |
| Block force pushes | sí | no reescribir historia publicada |
| Block deletions | sí | `main` no se borra |
| Enforce for admins | sí | la protección no tiene excepciones |

Efecto secundario esperado: con esto activo **ni el dueño puede pushear a `main`**, y la única vía es
PR. Es intencional.

## Versionado

- **Tags semver** `vMAJOR.MINOR.PATCH` sobre `main`, anotados y con nota de release:
  `git tag -a v1.2.0 -m "..." && git push origin v1.2.0`.
- Backend y frontend **versionan por separado**: cada repo tiene su propio `package.json` y sus
  propios tags. No hay versión conjunta del producto salvo que se decida lo contrario.
- `MAJOR` cuando cambia el contrato de la API o algo rompe consumidores; `MINOR` funcionalidad nueva
  compatible; `PATCH` correcciones.
- La versión de `package.json` se sube en la PR de release, no en cada PR de feature.
- Las releases se marcan desde `main` ya mergeado, nunca desde una rama de feature.

## Cómo aplicar la protección

Requiere un token con permiso de **admin** sobre el repo (hoy el token activo solo tiene `pull`):

```bash
gh auth switch --user <cuenta-dueña>   # o gh auth login

for repo in huugok/NatureMaps-Backend huugok/NatureMaps-Frontend; do
  gh api -X PUT "repos/$repo/branches/main/protection" \
    -H "Accept: application/vnd.github+json" \
    -F "required_status_checks=null" \
    -F "enforce_admins=true" \
    -F "required_pull_request_reviews[required_approving_review_count]=1" \
    -F "required_pull_request_reviews[dismiss_stale_reviews]=true" \
    -F "required_pull_request_reviews[require_code_owner_reviews]=false" \
    -F "required_pull_request_reviews[require_last_push_approval]=false" \
    -F "restrictions=null" \
    -F "required_conversation_resolution=true" \
    -F "required_linear_history=true" \
    -F "allow_force_pushes=false" \
    -F "allow_deletions=false" \
    -F "block_creations=false" \
    -F "lock_branch=false" \
    -F "allow_fork_syncing=true"
done
```

Variantes:

- **Repo en solitario**: cambia `required_approving_review_count` a `0`; si no, nadie puede mergear.
- **Cuando haya CI**: sustituye `required_status_checks=null` por
  `-F 'required_status_checks[strict]=true' -F 'required_status_checks[contexts][]=<check>'`.

Verificar y revertir:

```bash
gh api repos/<owner>/<repo>/branches/main/protection   # leer el estado actual
gh api -X DELETE repos/<owner>/<repo>/branches/main/protection   # desactivar todo
```

También se puede hacer desde la UI: **Settings → Branches → Branch protection rules → Add rule**,
con el mismo contenido que la tabla.

## Etiquetas de triage

Las cinco etiquetas canónicas (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
`wontfix`) se documentan en `triage-labels.md`. `wontfix`, `bug` y `enhancement` ya existen por
defecto en GitHub; las otras cuatro hay que crearlas con permiso de escritura:

```bash
for repo in huugok/NatureMaps-Backend huugok/NatureMaps-Frontend; do
  gh label create needs-triage     -R "$repo" --color d4c5f9 --description "Maintainer needs to evaluate this issue"
  gh label create needs-info       -R "$repo" --color fbca04 --description "Waiting on reporter for more information"
  gh label create ready-for-agent  -R "$repo" --color 0e8a16 --description "Fully specified, ready for an AFK agent"
  gh label create ready-for-human  -R "$repo" --color 1d76db --description "Requires human implementation"
done
```

## Estado actual

- Protección de `main`: **activa desde 2026-10-20** en ambos repos. Aplica también a admins, sin
  force-push, sin borrado, historial lineal y conversaciones resueltas. Aprobaciones requeridas:
  **0** (subir a 1 cuando haya una segunda persona con permiso de escritura).
- Status checks obligatorios: **ninguno todavía** (no hay CI). Al añadirlo, exigir el check.
- Etiquetas de triage: **creadas** (`needs-triage`, `needs-info`, `ready-for-agent`,
  `ready-for-human`); `wontfix`, `bug` y `enhancement` ya existían.
- PRs abiertas: frontend `#1` (`F16_Barra_Inferior` → `main`), sin mergear.
- Ramas de trabajo existentes: `explore_open_data` (backend), `F16_Barra_Inferior` (frontend),
  creadas antes de esta política y sin el prefijo `feat/`.
