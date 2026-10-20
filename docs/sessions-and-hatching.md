# 로그인과 부화

로그인은 앱 종료·재실행과 웹 새로고침 후에도 유지됩니다. Firebase 인증과 기기별 세션 ID를 함께 복원하며, 명시적으로 로그아웃하거나 다른 기기에서 새로 로그인하면 이전 기기의 접속이 종료됩니다. 일시적인 네트워크 오류는 로그아웃하지 않고 연결을 재시도합니다.

같은 계정으로 새 기기에서 로그인하면 이전 접속이 종료됩니다. Firestore의 `activeSessions/{uid}`와 Firebase가 서명한 `auth_time`을 대조해 이전 토큰의 데이터 접근도 차단합니다. 명시적 로그아웃은 현재 세션을 비활성화하고 저장한 세션 ID를 삭제합니다. 비밀번호를 별도로 저장하지 않으며, 인증 토큰은 Firebase의 플랫폼별 영속 저장소로 관리합니다.

배포 시 클라이언트와 `firestore.rules`를 함께 갱신해야 합니다. 이전 APK는 새 세션 규칙에 대응하지 않으므로 APK 업데이트가 필요합니다.

아기 컬렉션은 기존 십이지신 12종과 아기 고양이 10종으로 구성됩니다. 고양이 교배에서 기존 10% 아기 확률을 적용하고 부모와 같은 품종의 아기가 등장합니다. 부화 결과 저장을 확인한 후 흔들림, 균열, 껍질 파편, 결과 공개 순으로 연출합니다.

알은 코드로 그린 등급별 SVG이며, 코인·티켓·홈 아이콘과 시작 화면도 기존 그림 분위기를 유지하며 다듬었습니다. 아기 고양이는 내장 이미지 생성 도구로 각각 생성했습니다. 원본 크기의 이미지와 썸네일은 `assets/gacha/baby/characters/`, `assets/gacha/baby/thumbs/`에 있고, 사용한 프롬프트와 파일 경로는 [생성 기록](baby-cats-generation-prompts.json)에 있습니다.

검증: `node scripts/test-baby-cats.cjs`, `node scripts/test-cat-collections.cjs`, Firebase 로컬 에뮬레이터에서 `scripts/test-login-sessions.cjs`, `scripts/test-inventory-rules.cjs`, `scripts/test-community-rules.cjs`. 실제 사용자 데이터를 테스트에 사용하지 않습니다.
