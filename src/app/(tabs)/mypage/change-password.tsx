import { useCatalog } from '@/providers/catalog-provider';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { AccountForm } from '@/components/account-form';
import { changePassword } from '@/lib/account';

export default function ChangePasswordScreen() {
  useCatalog();
  return (
    <AccountForm
      fields={[
        { key: 'current', placeholder: '지금 비밀번호', secure: true },
        { key: 'next', placeholder: '새 비밀번호 (6자 이상)', secure: true },
        { key: 'confirm', placeholder: '새 비밀번호 확인', secure: true },
      ]}
      submitLabel="비밀번호 바꾸기"
      onSubmit={async ({ current, next, confirm }) => {
        if (next !== confirm) return '새 비밀번호가 서로 달라요.';
        const error = await changePassword(current, next);
        if (!error) Alert.alert('비밀번호를 바꿨어요', '', [{ text: '확인', onPress: () => router.back() }]);
        return error;
      }}
    />
  );
}
