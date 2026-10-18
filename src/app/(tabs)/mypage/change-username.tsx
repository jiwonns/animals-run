import { router } from 'expo-router';
import { Alert, Text } from 'react-native';

import { AccountForm } from '@/components/account-form';
import { useColors } from '@/hooks/use-colors';
import { changeUsername } from '@/lib/account';
import { useSession } from '@/providers/session-provider';

export default function ChangeUsernameScreen() {
  const colors = useColors();
  const { profile } = useSession();

  return (
    <AccountForm
      intro={
        <>
          <Text style={{ color: colors.secondary, fontSize: 13 }}>지금 아이디</Text>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{profile?.username}</Text>
          <Text style={{ color: colors.secondary, fontSize: 13 }}>바꾸면 다음 로그인부터 새 아이디를 써야 해요.</Text>
        </>
      }
      fields={[
        { key: 'username', placeholder: '새 아이디 (영문 소문자·숫자·_ 4~20자)' },
        { key: 'password', placeholder: '비밀번호 확인', secure: true },
      ]}
      submitLabel="아이디 바꾸기"
      onSubmit={async ({ username, password }) => {
        const error = await changeUsername(username, password);
        if (!error) Alert.alert('아이디를 바꿨어요', '', [{ text: '확인', onPress: () => router.back() }]);
        return error;
      }}
    />
  );
}
