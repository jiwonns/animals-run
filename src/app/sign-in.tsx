import { useCatalog } from '@/providers/catalog-provider';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { AuthForm } from '@/components/auth-form';
import { useColors } from '@/hooks/use-colors';
import { useConfirmExit } from '@/hooks/use-confirm-exit';
import { signIn } from '@/lib/auth';

export default function SignInScreen() {
  useCatalog();
  const colors = useColors();
  useConfirmExit();
  return (
    <AuthForm
      title="로그인"
      submitLabel="로그인"
      onSubmit={signIn}
      footer={
        <Pressable accessibilityRole="link" onPress={() => router.push('/sign-up')} hitSlop={8}>
          <Text style={{ color: '#A07155', fontSize: 14, fontWeight: '600' }}>
            처음이신가요? <Text style={{ color: colors.primary, fontWeight: '800' }}>회원가입</Text>
          </Text>
        </Pressable>
      }
    />
  );
}
