# Personal-Scripts

개인용 Tampermonkey userscript 공개 저장소.

## 프로젝트

| 프로젝트 | 상태 | 설명 |
| --- | --- | --- |
| [chatgpt-tweaks](./chatgpt-tweaks/) | Active | ChatGPT Chat 전용 웹 UI 개선 스크립트. 현재 v0.17.0. |
| [instagram-tweaks](./instagram-tweaks/) | Archived / FAIL | Instagram 웹 보조 스크립트. v1.1.2 정리본 · 기존 실사용 실패 후 개발 종료. 소스 보존용이며 사용 권장하지 않음. |
| [DCInside-tweaks](./DCInside-tweaks/) | Current | DCInside 레이아웃 보정·클릭 방해 제거·갤러리 즐겨찾기·이미지 댓글 숨김. 현재 v1.3.3. |

## 저장소 원칙

- 이 저장소에는 공개 배포하는 **userscript만** 둔다.
- 각 스크립트는 루트 바로 아래 독립 폴더로 관리한다.
- 브라우저 확장 프로그램과 web tool은 이 저장소에 넣지 않는다.
- 규모가 커져 독립 관리가 필요한 프로젝트만 별도 저장소로 분리한다.
- 자동·모의 테스트와 실제 브라우저 실사용 판정을 구분한다.

## 배포 구조

- 저장소: `NAEGYEIN/Personal-Scripts`
- ChatGPT Tweaks: `chatgpt-tweaks/`
- Instagram Tweaks: `instagram-tweaks/`
- DCInside Tweaks: `DCInside-tweaks/`

각 프로젝트의 `.user.js`와 `.meta.js`는 해당 프로젝트 폴더 안에서 관리한다.
