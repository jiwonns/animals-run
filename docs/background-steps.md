# 앱 종료 중 걸음 기록

설정의 '앱을 닫아도 걸음 기록'이 기본으로 켜집니다. 종전 foreground-only 설정은 새 기본값으로 이전하며 이후 선택은 유지합니다.

- Android: `StepCounterService`가 낮은 전력의 TYPE_STEP_COUNTER 구독을 유지. 앱이 백그라운드에 있거나 최근 앱 목록에서 닫혀도 걸음 기록을 계속하며, 기록 중 알림을 표시. 신체 활동 권한이 필요하고 Android 13 이상에서는 알림 권한도 요청. 알림을 거절해도 OS 정책상 허용되는 기록은 계속할 수 있음. 사용자가 설정에서 기록을 끄거나 로그아웃하면 서비스를 중지. 재부팅과 앱 업데이트 후에는 기록 설정이 켜진 경우 재개를 시도.
- iOS: Core Motion의 날짜별 기록을 다음 앱 실행/복귀 시 가져옴. 마지막 동기화 이후 누락된 날짜를 최대 7일 범위에서 먼저 정산.
- Expo Go, 센서 미지원 기기, 웹에서는 앱 밖 걸음 기록을 지원한다고 표시하지 않음.
- OS의 '강제 중지', 권한 취소, 제조사 배터리 제한으로 정지된 앱은 사용자가 다시 열어야 할 수 있음. Android 센서 실측은 센서가 있는 실제 기기에서 확인해야 함.

기기 센서 누적값·부팅 횟수와 일별 기록을 사용하며, Android 오늘 걸음은 이전 날짜의 미정산 걸음과 분리해 표시. `users/{uid}/stepSync/{deviceSource}` 서버 커서로 걸음/코인을 같은 트랜잭션에서 정산해 재시도·앱 종료 직전 응답 유실에 따른 중복 지급을 방지. 개인정보나 위치를 백그라운드에서 새로 전송하는 서비스가 아니며 서버 정산은 앱 실행 중에 수행.

Android 네이티브 서비스·권한이 추가되었으므로 새 APK/개발 빌드가 필요. 모듈 소스의 Manifest가 병합되어 CNG로 생성되는 `android/`를 수동 수정하지 않음.

검증: Kotlin `StepCounterLedgerTest`, 에뮬레이터 `scripts/test-login-sessions.cjs`의 세션 복원 및 걸음 중복 정산, lint/typecheck와 앱 번들.

근거: [Expo Pedometer](https://docs.expo.dev/versions/v58.0.0/sdk/pedometer/), [Android step counter](https://developer.android.com/reference/android/hardware/Sensor#TYPE_STEP_COUNTER), [Android health foreground service](https://developer.android.com/develop/background-work/services/fgs/service-types#health).
