# Changelog

## 0.17.0 — 2026-10-27

- ChatGPT **Chat 모드 전용**으로 동작 범위를 제한하고 Work에서는 대화 폭 CSS, 모델 고정, 새 채팅·메뉴·프로젝트 링크 overlay를 해제.
- Chat/Work 전환 컨트롤, 라우트, DOM 지연 마운트를 함께 판별하도록 surface lifecycle 추가.
- 프로젝트 우측 **대화 시작** 아이콘을 프로젝트 canonical URL과 연결해 휠 클릭·Ctrl+클릭·우클릭 새 탭을 지원.
- 프로젝트 생성·삭제·재정렬 시 현재 DOM을 재탐지하고 끊어진 target/overlay를 자동 정리.
- 기존 `cgpui.settings.v1`, `cgpui.bindings.v1`, 모델 입력/IME 보호, 자동 업데이트 경로 유지.
- 네비게이션·surface 관련 mutation만 재검사하고 대화 스트리밍 DOM은 계속 제외.
- 사용되지 않던 일부 DOM helper 인자 전달을 정리.

## 0.16.4 — 2026-10-26

- 세 userscript 자동 업데이트 교차검증을 위한 패치 버전 상승.
- ChatGPT Tweaks 기능 코드는 v0.16.3과 동일.

## 0.16.3 — 2026-10-26

- 저장소 이름을 `NAEGYEIN/Personal-Scripts` 기준으로 갱신.
- canonical userscript/meta 경로를 `chatgpt-tweaks/` 하위로 이전.
- 기존 루트 자동 업데이트 경로에서 v0.16.3을 감지할 수 있도록 호환 파일 유지.
- 기능 코드·설정 키는 v0.16.2와 동일.

## 0.16.2 — 2026-10-25

- 자동 업데이트 검증용 배포.
- userscript와 meta의 `@version`, 내부 `VERSION`만 `0.16.2`로 증가.
- v0.16.1의 기능 코드·설정 키·자동 업데이트 URL 유지.

## 0.16.1 — 2026-10-25

- **v0.16.0을 최신 기능 기준본으로 복구.**
- v0.16.0 기능 본문 유지.
- GitHub/Tampermonkey 자동 업데이트 구조 추가.
- `@homepageURL`, `@supportURL`, `@updateURL`, `@downloadURL` 추가.
- `@version` 및 내부 표시 버전만 `0.16.1`로 증가.
- 기존 `@name`, `@namespace`, 설정 저장 키 유지.

## 0.16.0 — 2026-10-21

- 안전 상태 머신 기반 모델 고정 구조 재설계.
- 현재 모델 우선 판독 및 목표 모델 일치 시 0-click 종료.
- 모델 선택기와 추론 수준 전용 컨트롤 분리.
- 2단계 모델 UI 대응.
- 사용자 소유 팝업 미조작.
- `/` → `/c/<id>` first-send route promotion 보호.
- `focus` 자동 재적용 제거.
- read-only 안정화 검증 및 retry 분리.
- 진단 로그 강화.
- 입력/IME 보호 유지.
- 원본 패키지 자동 검증 66개 PASS.
