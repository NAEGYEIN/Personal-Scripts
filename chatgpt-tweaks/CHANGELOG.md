# Changelog

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
