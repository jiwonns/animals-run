# 고양이 뽑기

실제 고양이 10품종을 모티브로 한 60종의 2D 캐릭터입니다. 품종의 우열이나 실제 희귀도를 뜻하는 등급이 아니라 게임 안의 의상·장식 변형입니다. 품종 목록과 모티브는 [CFA 품종 안내](https://cfa.org/breeds/)를 참고했습니다.

품종: 아메리칸 쇼트헤어, 브리티시 쇼트헤어, 러시안 블루, 샴, 랙돌, 페르시안, 메인쿤, 벵갈, 아비시니안, 터키시 앙고라.

| 등급 | 이미지 장식 | 뽑기 확률 |
| --- | --- | --- |
| 노말 | 품종 본연의 털색과 무늬 | 72% |
| 레어 | 하늘색 스카프와 작은 방울 | 20% |
| 에픽 | 달 장식과 짧은 보라 망토 | 5% |
| 유니크 | 작은 꽃 장식과 분홍 보석 | 2% |
| 레전더리 | 작은 왕관과 왕실 망토 | 0.9% |
| 히든 | 초승달 후광과 별빛 장식 | 0.1% |

등급 안의 10품종은 같은 확률입니다. 1회 10코인, 10회 90코인이며 뽑기권을 쓸 수 있습니다. 고양이 배너는 고양이 60종만 포함하고 기존 배너 확률은 유지합니다.

노말부터 레전더리까지 보관함·대표 동물·합성·재활용·교배에 기존 등급 규칙을 적용합니다. 진화는 같은 품종을 유지합니다. 히든은 기존 히든과 동일하게 합성·재활용·교배·진화 대상에서 제외합니다. 판매 가격은 공통 `rewards.json`을 따릅니다.

이미지는 **내장 imagegen 도구**로 개별 제작했습니다. 갈색 외곽선, 큰 머리와 작은 몸, 단순한 파스텔 2D, 투명 배경을 공통 기준으로 사용합니다. 실제 생성 프롬프트와 파일 목록은 [cats-generation-prompts.json](cats-generation-prompts.json)에, 전체 미리보기는 [cats-overview.jpg](assets/cats-overview.jpg)에 보관합니다. 앱용 원본은 `assets/gacha/cats*/characters/`, 목록용 축소본은 각 `thumbs/` 폴더에 있습니다.

검증 명령:

전체 미리보기의 행은 위에서부터 노말·레어·에픽·유니크·레전더리·히든입니다. 각 행의 품종 순서는 아비시니안·아메리칸 쇼트헤어·벵갈·브리티시 쇼트헤어·메인쿤·페르시안·랙돌·러시안 블루·샴·터키시 앙고라입니다.

```sh
node scripts/test-cat-collections.cjs
node scripts/test-inventory.cjs
npm run lint
npm run typecheck
npx firebase-tools emulators:exec --only firestore,auth --project demo-animalsrun --config firebase.community-test.json "node scripts/test-inventory-rules.cjs && node scripts/test-community-rules.cjs"
```

`scripts/install-cat-collections.cjs`는 60개 생성 원본이 모두 갖춰진 매니페스트만 설치합니다. 설치 후 `node scripts/optimize-images.js`, `node scripts/generate-gacha.js`를 순서대로 실행합니다. 새 고양이 ID와 전용 배너를 허용하려면 생성된 Firestore 규칙도 배포해야 합니다.
# Cat collection banner poster

The normal cat banner uses `assets/gacha/cats/poster.jpg`, a portrait illustration of ten breed-inspired cats playing in a flower garden. Generated with the built-in `image_gen.imagegen` tool, using `assets/gacha/normal/poster.jpg` as the style reference. Prompt: “Create one portrait game-banner illustration for a cute Korean mobile collection game. Use the attached existing zodiac collection poster only as the visual-style reference: warm hand-painted children's picture-book art, chubby round chibi animals, gentle watercolor-like grain, dark warm outlines, pastel garden, flowers and soft sky, cheerful polished composition. Subject: exactly ten distinct adorable real-breed cats, all playing together in a sunny garden: Siamese, orange tabby American Shorthair, gray British Shorthair, fluffy Persian, Ragdoll, Maine Coon, Bengal, Russian Blue, Abyssinian, Turkish Angora. Let them chase a ribbon, bat a yarn ball, roll on grass, play with a butterfly, and nap together. Every cat is clearly feline with two ears and a tail; visibly varied coat colors, patterns, and fur lengths. Arrange as a lively cohesive group filling the portrait canvas, leave a small clean sky area near the top for app UI overlay. Background scene extends fully to all edges, no borders, no empty cutout. Absolutely no text, letters, numbers, labels, logo, or watermark. Match the reference's sweet family-friendly charm while keeping the cat scene original.”
