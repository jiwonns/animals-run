import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { AuthForm } from '@/components/auth-form';
import { useColors } from '@/hooks/use-colors';
import { signUp } from '@/lib/auth';

export default function SignUpScreen() {
  const colors = useColors();
  return (
    <AuthForm
      title="회원가입"
      submitLabel="가입하고 100코인 + 띠 동물 받기"
      signUp
      onSubmit={signUp}
      footer={
        <Pressable accessibilityRole="link" onPress={() => router.back()} hitSlop={8}>
          <Text style={{ color: colors.secondary, fontSize: 15 }}>
            이미 계정이 있나요? <Text style={{ color: colors.primary, fontWeight: '700' }}>로그인</Text>
          </Text>
        </Pressable>
      }
    />
  );
}
