import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function MyPageLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '마이페이지' }} />
      <Stack.Screen name="avatar" options={{ title: '대표 동물' }} />
      <Stack.Screen name="achievements" options={{ title: '업적' }} />
      <Stack.Screen name="history" options={{ title: '뽑기 기록' }} />
      <Stack.Screen name="settings" options={{ title: '환경설정' }} />
      <Stack.Screen name="ranking" options={{ title: '랭킹' }} />
      <Stack.Screen name="terms" options={{ title: '이용약관' }} />
      <Stack.Screen name="change-nickname" options={{ title: '닉네임 변경' }} />
      <Stack.Screen name="change-username" options={{ title: '아이디 변경' }} />
      <Stack.Screen name="change-password" options={{ title: '비밀번호 변경' }} />
      <Stack.Screen name="delete-account" options={{ title: '회원탈퇴' }} />
    </Stack>
  );
}
