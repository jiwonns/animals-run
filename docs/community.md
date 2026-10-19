# 커뮤니티와 공개 프로필

- 홈의 커뮤니티에서 최근 글 60개를 실시간으로 읽습니다. 자유·자랑·질문·산책 필터를 제공합니다.
- 글 제목은 60자, 본문은 2,000자, 댓글은 500자까지 작성합니다. 댓글에 답글과 좋아요를 남길 수 있습니다. 원댓글을 삭제해도 기존 답글은 유지합니다.
- 자유는 일상과 사진, 자랑은 보유 동물 최대 3종, 질문은 분야와 상황 사진, 산책은 측정 걸음·목표 카드와 동반 동물·풍경 사진을 공유합니다. 걸음 센서를 사용할 수 없는 기기는 계정의 누적 걸음을 사용합니다. 공유 자체로 걸음이나 보상이 추가되지는 않습니다.
- 동물은 검색·등급 필터가 있는 4열 목록에서 선택합니다. 중복 개수 대신 보유 종류별로 보여줍니다.
- 사진은 최대 3장입니다. 별도의 Storage 버킷 없이 현재 Firestore의 `communityPosts/{postId}/photos/{0,1,2}`에 압축 JPEG를 저장합니다. 긴 변 1,200px 이하, 데이터 URI 350,000자 이하로 변환하며 글과 사진을 배치로 함께 저장합니다. 목록은 첫 사진만 읽고 나머지는 상세에서 읽습니다. 대규모 운영 시 Storage와 썸네일 처리로 이전해야 합니다.
- 작성자만 글과 댓글을 삭제할 수 있습니다. 글·댓글 좋아요는 각각 사용자 UID 문서 하나로 저장합니다.
- 랭킹·지도·게시글 작성자 사진은 `/player/[uid]`로 연결됩니다. 공개 랭킹의 대표 동물·걸음·보유 동물·활동 기록만 읽습니다. 비공개 `users` 문서는 타인에게 열지 않습니다.
- 커뮤니티 규칙의 원본은 `scripts/community.rules`입니다. `node scripts/generate-gacha.js`가 이를 `firestore.rules`에 포함합니다. 규칙 수정 후 Firebase에 배포해야 합니다.

검증:

```sh
npm run lint
npm run typecheck
node scripts/test-map-profile.cjs
npx firebase-tools emulators:exec --only firestore,auth --project demo-animalsrun --config firebase.community-test.json "node scripts/test-community-rules.cjs"
```

권한 테스트는 로컬 에뮬레이터만 사용하며 실제 프로젝트에 테스트 글을 게시하지 않습니다. 삭제한 글의 사진·댓글·좋아요는 규칙상 조회할 수 없지만 하위 문서는 남습니다. 대규모 운영 시 서버에서 하위 문서를 정리하는 작업이 필요합니다.
