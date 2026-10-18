import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { AuthForm } from '@/components/auth-form';
import { useColors } from '@/hooks/use-colors';
import { useConfirmExit } from '@/hooks/use-confirm-exit';
import { signIn } from '@/lib/auth';

export default function SignInScreen() {
  const colors = useColors();
  useConfirmExit();
  return (
    <AuthForm
      title="로그인"
      submitLabel="로그인"
      onSubmit={signIn}
      footer={
        <Pressable accessibilityRole="link" onPress={() => router.push('/sign-up')} hitSlop={8}>
          <Text style={{ color: colors.secondary, fontSize: 15 }}>
            처음이신가요? <Text style={{ color: colors.primary, fontWeight: '700' }}>회원가입</Text>
          </Text>
        </Pressable>
      }
    />
  );
}
