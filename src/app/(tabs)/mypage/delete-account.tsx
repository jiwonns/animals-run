import { Alert, Text } from 'react-native';

import { AccountForm } from '@/components/account-form';
import { useColors } from '@/hooks/use-colors';
import { deleteAccount } from '@/lib/account';

export default function DeleteAccountScreen() {
  const colors = useColors();

  return (
    <AccountForm
      danger
      intro={
        <>
          <Text style={{ color: colors.danger, fontSize: 16, fontWeight: '800' }}>탈퇴하면 되돌릴 수 없어요</Text>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
            코인, 뽑기권, 모은 동물, 알, 뽑기 기록, 업적, 걸음 기록, 랭킹이 모두 지워지고 같은 아이디로 다시 가입해도 복구되지
            않아요.
          </Text>
        </>
      }
      fields={[{ key: 'password', placeholder: '비밀번호 확인', secure: true }]}
      submitLabel="회원탈퇴"
      onSubmit={({ password }) =>
        new Promise((resolve) => {
          Alert.alert('정말 탈퇴할까요?', '모든 기록이 바로 지워져요.', [
            { text: '취소', style: 'cancel', onPress: () => resolve(null) },
            { text: '탈퇴', style: 'destructive', onPress: () => deleteAccount(password).then(resolve) },
          ]);
        })
      }
    />
  );
}
