# Scripts

개인용 Tampermonkey userscript 공개 저장소.

## 프로젝트

| 프로젝트 | 상태 | 설명 |
| --- | --- | --- |
| [chatgpt-tweaks](./chatgpt-tweaks/) | Active | ChatGPT 웹 UI 개선 스크립트. 현재 v0.16.2. |
| [instagram-web-plus](./instagram-web-plus/) | Archived / FAIL | Instagram 웹 보조 스크립트. v1.1.0 실사용 실패 후 개발 종료. 소스 보존용이며 사용 권장하지 않음. |

## 저장소 원칙

- 이 저장소에는 공개 배포하는 **userscript만** 둔다.
- 각 스크립트는 루트 바로 아래 독립 폴더로 관리한다.
- 브라우저 확장 프로그램과 web tool은 이 저장소에 넣지 않는다.
- 규모가 커져 독립 관리가 필요한 프로젝트만 별도 저장소로 분리한다.
- 자동·모의 테스트와 실제 브라우저 실사용 판정을 구분한다.

## 호환 파일

루트의 `chatgpt-tweaks.user.js`, `chatgpt-tweaks.meta.js`는 기존 Tampermonkey 설치의 자동 업데이트 경로를 끊지 않기 위한 **마이그레이션 호환 파일**이다.

정식 프로젝트 경로는 `chatgpt-tweaks/`이다. 기존 설치의 경로 이전이 끝나기 전에는 루트 호환 파일을 삭제하지 않는다.

## 저장소 이름

최종 저장소 이름은 `NAEGYEIN/scripts`를 사용한다. 저장소 이름 변경 후 ChatGPT Tweaks의 자동 업데이트 URL을 새 canonical 경로로 이전한다.
