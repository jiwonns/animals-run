# 경매장

홈 → 경매장. 모든 동물을 검색·등급·거래중 필터로 보고, 동물을 누르면 시세와 팔아요(파랑)·살게요(노랑) 목록이 나온다. NPC 판매와는 별개다.

## 시세와 가격 범위

동물마다 시세가 있고, 등록·구매희망은 시세의 70~130% 안에서만 가능하다.
등급별 하한·상한으로 한 번 더 막는다. 같은 동물은 싼 등록부터 사고, 비싼 구매희망부터 판다.
시세 밖으로 빠진 등록은 목록에 시세 밖으로 보이고, 주인이 경매장을 열면 자동 취소된다.

## 2시간 시세

한국 시간 짝수 시(0시, 2시, …)마다 칸이 바뀐다. 그 사이 체결 가격의 평균이 다음 시세가 된다.
거래가 없으면 시세는 유지된다. 지난 칸의 체결 건수는 시세가 갱신된 뒤에 보여 준다.

## 검사

```bash
node scripts/test-auction.cjs
npx firebase-tools emulators:exec --project demo-animalsrun --config firebase.community-test.json --only auth,firestore "node scripts/test-auction-rules.cjs"
```
