<p align="center">
  <img src="./banner.png" alt="copse" />
</p>

# 🌲 copse

[English](./README.md) | **한국어**

> Git worktree 매니저 — 터미널 UI

Git worktree를 쉽게 관리하세요. 설정 기반 자동화, 모노레포 지원, 헬스 체크로 worktree를 생성, 전환, 정리할 수 있습니다.

## 주요 기능

- **TUI 모드** — 인터랙티브 터미널 UI (`copse`)
- **CLI 모드** — 스크립트에서 사용 가능한 커맨드 (`copse add`, `copse list` 등)
- **설정 기반** — 레포별 훅, 파일 복사, 심볼릭 링크
- **모노레포 지원** — 패키지 자동 감지, 패키지별 훅, 포커스 추적
- **헬스 체크** — `copse doctor`로 worktree 문제 진단
- **중앙 집중식 worktree** — 기본적으로 `~/.copse/worktrees/`에 모든 worktree 관리
- **스마트 정리** — 머지된 worktree 자동 감지 및 제거
- **테마** — 9가지 내장 컬러 테마 (OpenCode, Tokyo Night, Dracula, Nord, Catppuccin, GitHub Dark, One Dark, Monokai, GitHub Light)
- **템플릿** — 재사용 가능한 worktree 프리셋 (`copse add --template review`)
- **크로스 worktree 실행** — 모든 worktree에서 명령 실행 (`copse exec "bun test"`)
- **GitHub PR 연동** — PR에서 worktree 생성 (`copse add --pr 123`)
- **퍼지 브랜치 피커** — TUI에서 타이핑하면 브랜치 자동완성
- **라이프사이클 관리** — 비활성/머지된 worktree 자동 감지, 제한 설정
- **의존성 공유** — `node_modules` 등을 하드링크/심볼릭으로 디스크 절약
- **Worktree 비교** — worktree 간 변경사항 비교 (`copse diff feature/a feature/b`)
- **핀 보호** — worktree를 자동 정리에서 보호 (`copse pin`)
- **활동 로그** — 생성/삭제/전환/리네임/아카이브/임포트 이벤트 추적 (`copse log`)
- **아카이브** — 제거 전 worktree 변경사항을 패치로 보존 (`copse archive`)
- **브랜치 리네임** — 메타데이터 마이그레이션과 함께 worktree 브랜치 이름 변경 (`copse rename`)
- **클론 및 초기화** — copse 설정과 함께 레포 클론 (`copse clone`)
- **Worktree 임포트** — 수동 생성된 worktree 채택 (`copse import`)
- **상세 뷰** — 커밋 히스토리, diff 통계, upstream 상태 확인 (TUI)
- **일괄 작업** — 다중 선택 및 배치 작업 (TUI)
- **토스트 알림** — 비동기 작업 결과 알림 (TUI)
- **셸 자동완성** — bash/zsh/fish 탭 자동완성 (`copse shell-init --completions`)
- **설정 프로필** — 설정 세트 전환 (`copse config --profiles`)
- **Tmux 세션** — worktree별 tmux 세션 자동 생성/종료, 레이아웃 템플릿 (`copse session`)
- **워크스페이스** — 부모 디렉토리 아래의 git repo를 자동 발견하고 워크스페이스별 defaults 적용 (`workspaces` 설정)
- **AI 에이전트 초기화** — 기본 설정 파일 생성 또는 Claude Code, Codex, OpenCode용 스킬 설치 (`copse init`, `copse init --skill`)

## 요구사항

- [Bun](https://bun.sh) 런타임
- git 2.17+
- macOS 또는 Linux
- [gh CLI](https://cli.github.com) (선택사항, `--pr` 플래그용)
- [tmux](https://github.com/tmux/tmux) (선택사항, `copse session`용)

## 설치

### Homebrew (macOS/Linux)

```bash
brew install getsolaris/tap/copse
```

### curl (원라이너)

```bash
curl -fsSL https://raw.githubusercontent.com/getsolaris/copse/main/install.sh | bash
```

### npm / bun

```bash
bun install -g @getsolaris/copse
# or
npm install -g @getsolaris/copse
```

## 빠른 시작

```bash
# TUI 실행
copse

# worktree 목록
copse list

# 새 worktree 생성
copse add feature/my-feature

# 모노레포 포커스와 함께 생성
copse add feature/my-feature --focus apps/web,apps/api

# GitHub PR에서 생성
copse add --pr 123

# 템플릿 사용
copse add feature/login --template review

# 모든 worktree에서 명령 실행
copse exec "bun test"

# 두 worktree 비교
copse diff feature/a feature/b --stat

# 헬스 체크
copse doctor

# worktree 전환 (셸 통합 필요)
copse switch feature/my-feature

# worktree 제거
copse remove feature/my-feature --yes

# 머지된 worktree 정리
copse clean --dry-run

# worktree 핀 설정 (정리에서 보호)
copse pin feature/important --reason "active sprint"

# 활동 로그 보기
copse log

# worktree 아카이브 후 제거
copse archive feature/done --yes

# worktree 브랜치 리네임
copse rename old-name new-name

# 레포 클론 및 copse 초기화
copse clone https://github.com/user/repo.git

# 기존 worktree 임포트
copse import /path/to/worktree

# worktree의 tmux 세션 열기/연결
copse session feature/my-feature

# tmux 세션과 함께 worktree 생성
copse add feature/new --session

# 설정 파일 초기화
copse init

# AI 에이전트 스킬 파일 생성
copse init --skill claude-code
```

## TUI 사용법

`copse` (인자 없이)로 실행합니다.

### 키보드 단축키

| 키 | 동작 |
|----|------|
| `j` / `k` | worktree 목록 탐색 |
| `a` | worktree 추가 |
| `d` | worktree 삭제 |
| `o` | 에디터로 열기 (focus 인식) |
| `h` | Doctor (헬스 체크) |
| `r` | 목록 새로고침 |
| `Ctrl+P` | 커맨드 팔레트 |
| `Enter` | 상세 뷰 열기 |
| `Escape` | 상세 뷰 / 피커 닫기 |
| `Space` | worktree 선택 토글 |
| `Ctrl+A` | 모든 worktree 선택 |
| `x` | 일괄 작업 메뉴 |
| `?` | 도움말 |
| `q` | 종료 |

#### `o` — Focus를 인식하는 에디터 열기

`o`를 누르면 선택된 worktree를 `$VISUAL` / `$EDITOR`로 엽니다:

- **focus 경로 없음** → worktree 루트를 엽니다.
- **focus 경로 1개** → `<worktree>/<focus>`를 바로 엽니다.
- **focus 경로 2개 이상** → 피커가 떠서 어떤 focus 경로(또는 worktree 루트)를 열지 선택할 수 있습니다.

피커는 `j`/`k` 또는 `↑`/`↓`로 탐색, `Enter`로 열기, `Esc`로 취소합니다.

### 커맨드 팔레트 (`Ctrl+P`)

검색 가능한 커맨드 메뉴:
- worktree 추가 / 삭제 / 새로고침
- Doctor 실행
- 설정 열기
- 테마 변경
- 종료

타이핑으로 필터, `↑↓`으로 탐색, `Enter`로 실행, `Esc`로 닫기.

### Worktree 생성 흐름

1. `a`를 눌러 생성 뷰 열기
2. 브랜치명 입력 시작 — 타이핑하면 매칭되는 브랜치가 표시됨
3. `↑↓`으로 추천 브랜치 선택, 또는 계속 입력하여 새 브랜치 생성
4. `Tab`으로 Focus 필드 전환 (선택사항)
5. 포커스 경로 입력 (예: `apps/web,apps/api`)
6. `Enter`로 미리보기
7. `Enter`로 확인

퍼지 브랜치 피커는 로컬/리모트 브랜치를 마지막 커밋 날짜 순으로 정렬하여 실시간 필터링합니다.

생성 후 설정된 `copyFiles`, `linkFiles`, `postCreate` 훅, 모노레포 훅이 자동으로 실행됩니다.

### Doctor 뷰

`h`를 눌러 Doctor 탭을 엽니다. 헬스 체크 결과 표시:
- ✓ Git 버전 확인
- ✓ 설정 유효성 검증
- ✓ 비활성 worktree 감지
- ✓ 고아 디렉토리 감지
- ✓ 잠금 상태 확인
- ✓ 더티 worktree 감지

`r`로 재확인, `Esc`로 돌아가기.

### Config 뷰

`Ctrl+P` → `Open Config`로 엽니다. Config 탭은 `~/.config/copse/config.json`의 전체 내용을 렌더링합니다:

- 최상위: `version`, `theme`, `activeProfile`
- `defaults` (`postRemove`, `autoUpstream`, `sharedDeps` 포함)
- 모든 레포별 오버라이드
- 전체 `monorepo` 트리 — `autoDetect`, `extraPatterns`, 각 `hooks[]` 항목과 `glob` / `copyFiles` / `linkFiles` / `postCreate` / `postRemove`
- `templates`, `lifecycle`, `sessions`, `profiles`

대부분의 스칼라/문자열 배열 필드는 인라인으로 수정 가능합니다. 헤더 카운터(`1/20`)는 현재 선택된 필드 위치를 나타냅니다.

| 키 | 동작 |
| --- | --- |
| `j` / `k` | 수정 가능한 필드 이동 |
| `g` / `G` | 첫 번째 / 마지막 필드로 이동 |
| `Enter` | 선택된 필드 편집 시작 |
| `Tab` | 프리셋 값 순환 (편집 모드) |
| `Space` / `←→` | 불리언 토글 / 테마 변경 (편집 모드) |
| `Enter` | 편집 커밋 (디스크에 저장 후 재로드) |
| `Esc` | 편집 취소 |
| `e` | `$EDITOR`로 config 파일 열기 |
| `r` | 디스크에서 파일 재로드 |
| `i` | 설정 파일 초기화 |

인라인 편집은 다섯 종류의 필드를 지원합니다:

- **문자열** — 일반 텍스트 입력 (예: `worktreeDir`, 훅 `glob`, `sessions.prefix`). `Tab`으로 자주 쓰이는 프리셋 순환
- **문자열 배열** — `[".env", ".env.local"]` 같은 JSON 입력. 빈 입력은 `[]`로 처리. `Tab`으로 프리셋 순환 (`[]` 빈 배열도 첫 프리셋으로 포함)
- **불리언** — `Space`, `Tab`, `←→`로 토글, `Enter`로 커밋
- **테마** — `Tab` 또는 `←→`로 순환, `Enter`로 커밋. 새 테마는 즉시 적용됨
- **Enum** — 유효한 값이 고정된 필드 (예: `sharedDeps.strategy` = `hardlink` / `symlink` / `copy`). `Tab` 또는 `←→`로 순환, `Enter`로 커밋

푸터에 현재 프리셋 위치가 표시됩니다 (예: `Tab:preset (2/4)`). 순환은 현재 값과 일치하는 위치에서 시작하므로, 첫 `Tab` 입력은 항상 다른 값으로 이동합니다.

커밋 시 `validateConfig`로 유효성 검증 후 파일에 기록합니다. 유효하지 않은 입력은 인라인 에러로 표시되며 수정할 수 있도록 편집 모드가 유지됩니다. 복잡한 필드(`sessions.layouts`, `templates`, `profiles`)는 `e`로 `$EDITOR`를 열어 편집하세요.

## CLI 커맨드

| 커맨드 | 설명 |
|--------|------|
| `copse` | TUI 실행 |
| `copse list` | 모든 worktree 목록 (포커스 정보 포함) |
| `copse add <branch>` | worktree 생성 |
| `copse remove <branch>` | worktree 제거 |
| `copse switch <branch>` | worktree 전환 |
| `copse clean` | 머지된 worktree 제거 |
| `copse doctor` | worktree 헬스 체크 |
| `copse config` | 설정 관리 |
| `copse exec <command>` | 각 worktree에서 명령 실행 |
| `copse diff <ref1> [ref2]` | worktree/브랜치 간 diff |
| `copse pin <branch>` | worktree 핀/언핀 (정리에서 보호) |
| `copse log` | worktree 활동 로그 보기 |
| `copse archive <branch>` | 변경사항 아카이브 후 선택적 제거 |
| `copse rename <old> <new>` | worktree 브랜치 리네임 |
| `copse clone <url>` | 레포 클론 및 copse 초기화 |
| `copse import <path>` | copse 메타데이터로 worktree 채택 |
| `copse session [branch]` | worktree의 tmux 세션 관리 |
| `copse open [branch]` | worktree를 에디터로 열기 (focus 인식) |
| `copse init`             | 설정 초기화 또는 AI 에이전트 스킬 설치 |

### `copse add`

```bash
copse add feature/login                        # 필요하면 브랜치를 만들고 worktree 생성
copse add feature/login --base main            # 새 브랜치는 main에서 시작
copse add existing-branch                      # 기존 브랜치로 worktree 생성

# 모노레포: 포커스 패키지와 함께 생성
copse add feature/login --focus apps/web,apps/api
copse add feature/login --focus apps/web --focus apps/api

# 템플릿 사용
copse add feature/login --template review

# GitHub PR에서 생성 (gh CLI 필요)
copse add --pr 123
copse add --pr 456 --template review
```

### `copse doctor`

```bash
copse doctor              # 사람이 읽기 쉬운 출력
copse doctor --json       # 스크립팅용 JSON 출력
```

종료 코드: 정상이면 `0`, 경고 또는 에러가 있으면 `1`.

```
copse doctor

✓ Git version: 2.39.0 (>= 2.17 required)
✓ Configuration: valid
✓ Stale worktrees: none
✓ Orphaned directories: none
✓ Worktree locks: all clear
✓ Dirty worktrees: none

All checks passed.
```

### `copse list`

```bash
copse list                # Focus 컬럼이 포함된 테이블
copse list --json         # 포커스 배열이 포함된 JSON
copse list --porcelain    # 머신 판독 가능 형식
```

모노레포 worktree별 포커스 경로를 `Focus` 컬럼에 표시합니다.

### `copse remove`

```bash
copse remove feature/login               # 브랜치명으로 제거
copse remove feature/login --force        # 강제 제거 (더티 worktree)
copse remove feature/login --yes          # 확인 건너뛰기
```

### `copse clean`

```bash
copse clean --dry-run    # 제거될 항목 미리보기
copse clean              # 머지된 worktree 모두 제거
copse clean --stale      # 비활성 worktree도 표시 (lifecycle 설정 사용)
```

### `copse exec`

모든 비-메인 worktree에서 셸 커맨드를 실행합니다.

```bash
copse exec "bun test"                   # 모든 worktree에서 실행 (순차)
copse exec "bun test" --parallel        # 병렬 실행
copse exec "git pull" --all             # 모든 설정된 레포에서 실행
copse exec "bun install" --dirty        # 더티 worktree만
copse exec "git rebase main" --behind   # upstream보다 뒤처진 것만
copse exec "bun test" --json            # JSON 출력
```

| 플래그 | 설명 |
|--------|------|
| `--parallel` / `-p` | 병렬 실행 |
| `--all` / `-a` | 모든 설정된 레포 포함 |
| `--dirty` | 더티 worktree에서만 실행 |
| `--clean` | 클린 worktree에서만 실행 |
| `--behind` | upstream보다 뒤처진 worktree에서만 실행 |
| `--json` / `-j` | 결과를 JSON으로 출력 |

커맨드에서 사용 가능한 환경변수: `COPSE_BRANCH`, `COPSE_WORKTREE_PATH`, `COPSE_REPO_PATH`.

### `copse diff`

두 worktree 브랜치 간 diff를 보여줍니다.

```bash
copse diff feature/a feature/b         # 전체 diff
copse diff feature/a feature/b --stat  # diffstat 요약
copse diff feature/a --name-only       # 변경된 파일명만
copse diff feature/a                   # 현재 HEAD와 비교
```

### `copse pin`

```bash
copse pin feature/auth --reason "active sprint"  # 사유와 함께 핀
copse pin --list                                  # 핀된 worktree 목록
copse pin --list --json                           # JSON 출력
copse unpin feature/auth                          # 언핀
```

핀된 worktree는 `copse clean` 및 라이프사이클 자동 정리에서 제외됩니다.

### `copse log`

```bash
copse log                # 최근 20개 이벤트 표시
copse log --limit 50     # 최근 50개 이벤트 표시
copse log --json         # JSON 출력
copse log --clear        # 활동 로그 초기화
```

이벤트는 색상으로 구분: 생성(초록), 삭제(빨강), 전환(파랑), 리네임(노랑), 아카이브(자홍), 임포트(시안).

### `copse archive`

```bash
copse archive feature/done --yes       # 아카이브 후 제거
copse archive feature/wip --keep       # 제거 없이 아카이브만
copse archive --list                   # 모든 아카이브 목록
copse archive --list --json            # JSON 출력
```

아카이브는 `~/.copse/archives/`에 패치 파일로 저장됩니다.

### `copse rename`

```bash
copse rename old-branch new-branch             # 브랜치 리네임
copse rename old-branch new-branch --move-path # worktree 디렉토리도 이동
```

### `copse clone`

```bash
copse clone https://github.com/user/repo.git              # 클론 및 초기화
copse clone https://github.com/user/repo.git ./my-dir     # 커스텀 대상 경로
copse clone https://github.com/user/repo.git --template review # 템플릿 적용
copse clone https://github.com/user/repo.git --no-init-config  # 설정 초기화 건너뛰기
```

### `copse import`

```bash
copse import /path/to/worktree                           # worktree 채택
copse import /path/to/worktree --focus apps/web,apps/api # 포커스와 함께
copse import /path/to/worktree --pin                     # 즉시 핀 설정
```

### `copse session`

worktree의 tmux 세션을 관리합니다. tmux가 필요합니다.

```bash
copse session feature/auth              # 세션 열기/연결 (없으면 생성)
copse session feature/auth --layout api # 설정의 레이아웃 사용
copse session --list                    # 활성 copse 세션 목록
copse session --list --json             # JSON 출력
copse session feature/auth --kill       # worktree 세션 종료
copse session --kill-all                # 모든 copse 세션 종료
```

설정에서 `sessions.autoCreate` / `sessions.autoKill`을 활성화하면 세션이 자동 생성/종료됩니다.

```bash
# tmux 세션과 함께 worktree 생성
copse add feature/login --session
copse add feature/login --session --layout api
```

`sessions.enabled`가 `true`이고 tmux 안에 있으면, `copse switch`가 대상 worktree의 tmux 세션으로 자동 전환합니다.

### `copse open`

worktree를 에디터/IDE로 엽니다. `$VISUAL` / `$EDITOR`를 자동 감지하고, 없으면 알려진 에디터 목록(`code`, `cursor`, `vim`, `nvim`, `emacs`, `nano`, `subl`, `zed`, `idea`, `webstorm`)에서 찾습니다.

```bash
copse open                              # 현재 worktree 열기
copse open feature/auth                 # 특정 worktree 열기
copse open feature/auth -e nvim         # 에디터 강제 지정

# Focus 인식 동작 (--focus로 생성된 worktree에서)
copse open feature/auth                 # focus 1개 → 해당 focus 경로로 열림
                                      # focus 2개+ → 에러 + 힌트 출력
copse open feature/auth --focus apps/web   # 특정 focus 경로 선택
copse open feature/auth -f apps/api        # 짧은 별칭
copse open feature/auth --root             # focus 무시하고 worktree 루트 강제

copse open --list-editors               # 감지된 에디터 목록
```

| 플래그 | 별칭 | 설명 |
| ------ | ---- | ---- |
| `--editor` | `-e` | 사용할 에디터 (`$VISUAL`/`$EDITOR` 무시) |
| `--focus` | `-f` | 특정 focus 경로 열기 (worktree에 설정된 focus 항목과 일치해야 함) |
| `--root` | | focus를 무시하고 worktree 루트 강제 열기 |
| `--list-editors` | | 감지된 에디터 목록 |

**Focus 해석 규칙:**

- focus 경로 없음 → worktree 루트를 엽니다.
- focus 경로 1개 → `<worktree>/<focus>`를 자동으로 엽니다.
- focus 경로 2개 이상 → 에러를 내고 `--focus <path>` 또는 `--root`를 요구합니다 (TUI에서는 대신 인터랙티브 피커를 띄웁니다).

### `copse init`

기본적으로 copse 설정 파일을 초기화하고, 필요하면 AI 코딩 에이전트용 스킬도 설치합니다.

```bash
copse init                         # → ~/.config/copse/config.json
copse init --skill claude-code   # → ~/.claude/skills/copse/
copse init --skill codex          # → ~/.agents/skills/copse/
copse init --skill opencode       # → ~/.config/opencode/skill/copse/
```

| 플랫폼 | 스킬 경로 |
|--------|----------|
| `claude-code` | `~/.claude/skills/copse/` |
| `codex` | `~/.agents/skills/copse/` |
| `opencode` | `~/.config/opencode/skill/copse/` |

각 스킬 디렉토리에는 다음이 포함됩니다:
- `SKILL.md` — 개요와 공통 워크플로우
- `references/` — 명령별 상세 문서 (21개 파일)

`--skill` 없이 실행하면 기존 설정 초기화 로직을 재사용하여 `config.json`만 생성합니다.
멱등성 — 다시 실행하면 스킬 디렉토리를 업데이트합니다.

#### 첫 실행 시 자동 초기화

`copse init`을 직접 실행할 필요가 없습니다. 처음으로 `copse` 명령어(또는 TUI)를 실행할 때 `~/.config/copse/config.json`이 없으면, copse가 기본 설정으로 자동 생성하고 stderr에 한 줄짜리 알림을 출력합니다:

```
copse: created default config at /Users/you/.config/copse/config.json
```

이 알림은 stdout이 TTY가 아닐 때(파이프, 스크립트, CI 환경)와 `copse init`을 명시적으로 실행할 때(중복 메시지 방지)는 표시되지 않습니다. 자동 초기화는 멱등성을 가지므로 이후 실행에서는 아무 동작도 하지 않습니다.

## 설정

설정 파일: `~/.config/copse/config.json`

초기화: `copse config --init` (또는 아무 `copse` 명령어 실행 — [첫 실행 시 자동 초기화](#첫-실행-시-자동-초기화) 참조)

### 전체 예시

```json
{
  "$schema": "https://raw.githubusercontent.com/getsolaris/copse/main/schema.json",
  "version": 1,
  "theme": "dracula",
  "defaults": {
    "worktreeDir": "~/.copse/worktrees/{repo}-{branch}",
    "copyFiles": [".env"],
    "linkFiles": ["node_modules"],
    "postCreate": ["bun install"],
    "postRemove": [],
    "sharedDeps": {
      "strategy": "hardlink",
      "paths": ["node_modules"],
      "invalidateOn": ["package.json", "bun.lockb"]
    }
  },
  "templates": {
    "review": {
      "copyFiles": [".env.local"],
      "postCreate": ["bun install", "bun run build"],
      "autoUpstream": true
    },
    "hotfix": {
      "base": "main",
      "copyFiles": [".env.production"],
      "postCreate": ["bun install"]
    },
    "experiment": {
      "worktreeDir": "~/tmp/experiments/{branch}",
      "postRemove": []
    }
  },
  "lifecycle": {
    "autoCleanMerged": true,
    "staleAfterDays": 14,
    "maxWorktrees": 10
  },
  "sessions": {
    "enabled": true,
    "autoCreate": false,
    "autoKill": true,
    "prefix": "copse",
    "defaultLayout": "dev",
    "layouts": {
      "dev": {
        "windows": [
          { "name": "editor", "command": "$EDITOR ." },
          { "name": "dev", "command": "bun dev" },
          { "name": "test", "command": "bun test --watch" }
        ]
      },
      "minimal": {
        "windows": [
          { "name": "shell" }
        ]
      }
    }
  },
  "workspaces": [
    {
      "path": "~/Desktop/work",
      "depth": 1,
      "exclude": ["node_modules", ".cache", "archived"],
      "defaults": {
        "copyFiles": [".env", ".env.local"],
        "linkFiles": ["node_modules"],
        "postCreate": ["bun install"],
        "autoUpstream": true
      }
    }
  ],
  "repos": [
    {
      "path": "/Users/me/dev/frontend",
      "copyFiles": [".env", ".env.local"],
      "linkFiles": ["node_modules", ".next"],
      "postCreate": ["bun install", "bun run build"]
    },
    {
      "path": "/Users/me/dev/backend",
      "copyFiles": [".env"],
      "postCreate": ["pip install -r requirements.txt"]
    },
    {
      "path": "/Users/me/dev/monorepo",
      "copyFiles": [".env"],
      "postCreate": ["pnpm install"],
      "monorepo": {
        "autoDetect": true,
        "extraPatterns": ["apps/*/*"],
        "hooks": [
          {
            "glob": "apps/web",
            "copyFiles": [".env"],
            "postCreate": ["cd {packagePath} && pnpm install"]
          },
          {
            "glob": "apps/api",
            "copyFiles": [".env"],
            "linkFiles": ["node_modules"],
            "postCreate": ["cd {packagePath} && pnpm install && pnpm build"]
          }
        ]
      }
    }
  ]
}
```

### 설정 필드

#### `defaults`

모든 레포가 이 설정을 상속합니다 (레포별 오버라이드 가능).

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `worktreeDir` | `string` | `~/.copse/worktrees/{repo}-{branch}` | worktree 디렉토리 패턴 |
| `copyFiles` | `string[]` | `[]` | 메인 레포에서 복사할 파일 |
| `linkFiles` | `string[]` | `[]` | 심볼릭 링크할 파일/디렉토리 (디스크 절약) |
| `postCreate` | `string[]` | `[]` | worktree 생성 후 실행할 커맨드 |
| `postRemove` | `string[]` | `[]` | worktree 제거 전 실행할 커맨드 |

#### `repos[]`

레포별 오버라이드. 각 항목은 `path`가 필수입니다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `path` | `string` | 예 | 레포의 절대 경로 |
| `worktreeDir` | `string` | 아니오 | 기본 worktree 디렉토리 오버라이드 |
| `copyFiles` | `string[]` | 아니오 | 기본 복사 파일 오버라이드 |
| `linkFiles` | `string[]` | 아니오 | 기본 링크 파일 오버라이드 |
| `postCreate` | `string[]` | 아니오 | 기본 postCreate 훅 오버라이드 |
| `postRemove` | `string[]` | 아니오 | 기본 postRemove 훅 오버라이드 |
| `monorepo` | `object` | 아니오 | 모노레포 지원 설정 |

#### `workspaces[]`

부모 디렉토리 아래의 git 레포를 자동으로 발견합니다. 발견된 각 레포는 로드 시점에 `repos[]`에 병합되며, 워크스페이스의 `defaults`가 레포 오버라이드 레이어로 적용됩니다.

```json
{
  "workspaces": [
    {
      "path": "~/Desktop/work",
      "depth": 1,
      "exclude": ["node_modules", ".cache", "archived"],
      "defaults": {
        "copyFiles": [".env", ".env.local"],
        "linkFiles": ["node_modules"],
        "postCreate": ["bun install"],
        "autoUpstream": true
      }
    }
  ]
}
```

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `path` | `string` | 예 | — | 스캔할 부모 디렉토리. `~` 확장 지원. |
| `depth` | `integer` | 아니오 | `1` | 스캔 깊이 (1–3). `1`은 직계 자식만 스캔. |
| `exclude` | `string[]` | 아니오 | `[]` | 디렉토리 이름에 매칭되는 글롭 패턴으로 제외 (예: `node_modules`). |
| `defaults` | `object` | 아니오 | — | 발견된 모든 레포에 적용할 기본값. `defaults`와 동일한 필드. |

**발견 규칙:**

- `.git`이 **디렉토리**인 경우에만 레포로 간주됩니다. `.git`이 파일이면 (linked worktree 또는 submodule) 제외됩니다.
- 발견된 레포의 하위는 더 이상 스캔하지 않습니다 (레포 안으로 재귀하지 않음).
- 심볼릭 링크는 따라가지 않습니다.
- 발견은 `loadConfig()` 호출마다 실행됩니다. 캐시가 없습니다.

**우선순위 (높음 → 낮음):**

1. 동일한 resolved path를 가진 명시적 `repos[]` 엔트리 — 전체 승리.
2. `workspaces[].defaults` — 레포 레벨 오버라이드 레이어.
3. 전역 `defaults`.
4. 내장 기본값.

**`workspaces[].defaults`는 `monorepo` 필드를 지원하지 않습니다.** 발견된 레포에 monorepo 훅이 필요하면 명시적 `repos[]` 엔트리를 추가하세요.

**TUI 표시:** Config 뷰(Ctrl+P → Open Config)는 파일에 *작성된 그대로* 보여줍니다. 워크스페이스에서 자동 발견된 레포는 `Repos (N)`가 아닌 별도의 `Workspaces (N)` 섹션에 표시됩니다. 따라서 `Repos` 카운트는 워크스페이스 자동 발견과 무관하게 명시적인 `repos[]` 엔트리만 반영합니다. Config 뷰에서 어떤 필드를 편집하든 사용자가 작성한 원본 형태가 디스크에 저장되므로, 자동 발견된 레포가 `repos[]`로 영구화되는 일은 없습니다.

#### `monorepo`

범용 모노레포 지원. 워크스페이스 설정 파일에서 패키지를 자동 감지하고 패키지별 훅을 지원합니다.

```json
{
  "monorepo": {
    "autoDetect": true,
    "extraPatterns": ["apps/*/*"],
    "hooks": [
      {
        "glob": "apps/mobile/*",
        "copyFiles": [".env"],
        "linkFiles": ["node_modules"],
        "postCreate": ["cd {packagePath} && pnpm install"]
      }
    ]
  }
}
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `autoDetect` | `boolean` | `true` | 모노레포 도구 자동 감지 |
| `extraPatterns` | `string[]` | `[]` | 패키지 탐색용 추가 glob 패턴 |
| `hooks` | `array` | `[]` | 패키지별 훅 정의 |

**자동 감지** 지원: pnpm workspaces, Turborepo, Nx, Lerna, npm/yarn workspaces.

**`extraPatterns`**는 자동 감지에서 누락된 패키지를 잡습니다. 예를 들어, `pnpm-workspace.yaml`이 `packages/*`만 커버하는데 `apps/frontend/dashboard`에도 앱이 있다면 `extraPatterns: ["apps/*/*"]`를 사용하세요.

#### `monorepo.hooks[]`

포커스 경로에 대해 glob 패턴으로 매칭되는 패키지별 훅.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `glob` | `string` | 예 | 포커스 경로 매칭용 glob (예: `apps/*`, `apps/mobile/*`) |
| `copyFiles` | `string[]` | 아니오 | 매칭된 패키지 디렉토리 내에서 복사할 파일 |
| `linkFiles` | `string[]` | 아니오 | 매칭된 패키지 디렉토리 내에서 심볼릭 링크할 파일/디렉토리 |
| `postCreate` | `string[]` | 아니오 | 생성 후 실행할 커맨드. `{packagePath}`, `{repo}`, `{branch}` 지원 |
| `postRemove` | `string[]` | 아니오 | 제거 전 실행할 커맨드 |

훅은 선언 순서대로 실행되며, 레포 레벨 `postCreate`/`postRemove` 이후에 실행됩니다.

**훅 내 `copyFiles`/`linkFiles`**는 레포 루트가 아닌 **패키지 서브디렉토리**에서 동작합니다. 예를 들어, `glob: "apps/mobile/*"`이고 `copyFiles: [".env"]`이면, `.env` 파일은 `<메인-레포>/apps/mobile/ios/.env`에서 `<worktree>/apps/mobile/ios/.env`로 복사됩니다.

#### `templates`

worktree 생성을 위한 이름이 붙은 프리셋. 각 템플릿은 기본값 필드를 오버라이드할 수 있습니다.

```json
{
  "templates": {
    "review": {
      "copyFiles": [".env.local"],
      "postCreate": ["bun install", "bun run build"],
      "autoUpstream": true
    },
    "hotfix": {
      "base": "main",
      "copyFiles": [".env.production"],
      "postCreate": ["bun install"]
    }
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `worktreeDir` | `string` | worktree 디렉토리 오버라이드 |
| `copyFiles` | `string[]` | 복사할 파일 오버라이드 |
| `linkFiles` | `string[]` | 심볼릭 링크할 파일 오버라이드 |
| `postCreate` | `string[]` | postCreate 훅 오버라이드 |
| `postRemove` | `string[]` | postRemove 훅 오버라이드 |
| `autoUpstream` | `boolean` | upstream 추적 오버라이드 |
| `base` | `string` | 새로 생성되는 브랜치의 기본 베이스 브랜치 |

사용법: `copse add feature/login --template review`

템플릿 값은 리졸브된 레포 설정을 오버라이드합니다. `base` 필드는 `--base`가 명시적으로 제공되지 않은 경우 기본값을 설정합니다.

#### `lifecycle`

자동 worktree 라이프사이클 관리. `copse clean --stale`에서 사용됩니다.

```json
{
  "lifecycle": {
    "autoCleanMerged": true,
    "staleAfterDays": 14,
    "maxWorktrees": 10
  }
}
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `autoCleanMerged` | `boolean` | `false` | 머지된 worktree를 정리 대상으로 표시 |
| `staleAfterDays` | `number` | — | 비활성으로 표시하기까지 일수 |
| `maxWorktrees` | `number` | — | 이 수를 초과하면 경고 |

#### `sessions`

worktree별 tmux 세션 관리.

```json
{
  "sessions": {
    "enabled": true,
    "autoCreate": true,
    "autoKill": true,
    "prefix": "copse",
    "defaultLayout": "dev",
    "layouts": {
      "dev": {
        "windows": [
          { "name": "editor", "command": "$EDITOR ." },
          { "name": "dev", "command": "bun dev" },
          { "name": "test", "command": "bun test --watch" }
        ]
      }
    }
  }
}
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 세션 연동 활성화 (tmux 내 자동 전환) |
| `autoCreate` | `boolean` | `false` | `copse add` 시 tmux 세션 자동 생성 |
| `autoKill` | `boolean` | `false` | `copse remove` 시 tmux 세션 자동 종료 |
| `prefix` | `string` | `"copse"` | tmux 세션 이름 접두사 |
| `defaultLayout` | `string` | — | 새 세션의 기본 레이아웃 이름 |
| `layouts` | `object` | `{}` | 윈도우 정의가 포함된 이름 있는 레이아웃 |

**레이아웃 윈도우:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | `string` | 예 | 윈도우 이름 |
| `command` | `string` | 아니오 | 윈도우에서 실행할 커맨드 |

세션 이름 규칙: 브랜치 `feat/auth-token` → tmux 세션 `copse_feat-auth-token`.

#### `sharedDeps`

메인 레포와 worktree 간 의존성을 공유하여 디스크 공간을 절약합니다. `defaults` 또는 레포별로 설정 가능합니다.

```json
{
  "defaults": {
    "sharedDeps": {
      "strategy": "hardlink",
      "paths": ["node_modules"],
      "invalidateOn": ["package.json", "bun.lockb"]
    }
  }
}
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `strategy` | `string` | `"symlink"` | `"hardlink"`, `"symlink"`, 또는 `"copy"` |
| `paths` | `string[]` | `[]` | 공유할 디렉토리/파일 |
| `invalidateOn` | `string[]` | `[]` | 변경 시 재공유를 트리거하는 파일 |

**전략:**
- `hardlink` — 각 파일에 하드 링크 생성 (디스크 절약, 다시 쓰여지는 파일은 worktree마다 독립적으로 수정 가능)
- `symlink` — 소스 디렉토리에 심볼릭 링크 생성 (최대 디스크 절약, 상태 공유)
- `copy` — 일반 복사로 폴백

### `--focus` 플래그

worktree가 작업 중인 모노레포 패키지를 추적합니다.

```bash
copse add feature/login --focus apps/web,apps/api
```

- 쉼표, 공백, 또는 여러 `--focus` 플래그 지원
- 포커스 메타데이터는 git 내부에 저장 (worktree 루트가 아님)
- `copse list`에서 worktree별 포커스 경로 표시
- 모노레포 훅은 매칭되는 포커스 경로에 대해서만 실행
- 포커스는 선택사항 — 생략하면 일반 worktree 생성

### 템플릿 변수

`worktreeDir` 및 모노레포 훅 커맨드에서 사용 가능:

| 변수 | 설명 | 예시 |
|------|------|------|
| `{repo}` | 레포 디렉토리 이름 | `my-app` |
| `{branch}` | 브랜치 이름 (`/`는 `-`로 대체) | `feature-auth` |
| `{packagePath}` | 매칭된 패키지 경로 (모노레포 훅 전용) | `apps/web` |
| `~` | 홈 디렉토리 (경로 시작 위치에서만) | `/Users/me` |

### 우선순위

레포별 설정은 기본값을 완전히 대체합니다 (머지 없음):

```
repos[].copyFiles 존재?  →  repos[].copyFiles 사용
repos[].copyFiles 없음?  →  defaults.copyFiles 사용
defaults.copyFiles 없음? →  [] (빈 배열) 사용
```

### 테마

설정 파일 또는 커맨드 팔레트 (`Ctrl+P`)에서 설정:

```json
{ "theme": "tokyo-night" }
```

사용 가능: `opencode`, `tokyo-night`, `dracula`, `nord`, `catppuccin`, `github-dark`, `one-dark`, `monokai`, `github-light`

## 셸 통합

`copse shell-init`으로 `copse switch`용 셸 통합을 설치하세요.

### 셸 자동완성

```bash
# 자동완성 추가 (bash)
eval "$(copse shell-init --completions bash)"

# 자동완성 추가 (zsh)
eval "$(copse shell-init --completions zsh)"

# 자동완성 추가 (fish)
copse shell-init --completions fish | source
```

### 예시

```bash
# zsh
echo 'eval "$(copse shell-init zsh)"' >> ~/.zshrc
source ~/.zshrc

# bash
echo 'eval "$(copse shell-init bash)"' >> ~/.bashrc
source ~/.bashrc

# fish
copse shell-init fish >> ~/.config/fish/config.fish
source ~/.config/fish/config.fish
```

설정 저장 전 생성될 래퍼를 미리 볼 수도 있습니다:

```bash
copse shell-init zsh
```

## 설정 프로필

서로 다른 설정 세트 간 전환합니다.

```bash
copse config --profiles                    # 프로필 목록
copse config --profile work --activate     # 프로필 활성화
copse config --profile personal --delete   # 프로필 삭제
```

## 라이선스

MIT © getsolaris
