import { useCatalog } from '@/providers/catalog-provider';
import { router } from 'expo-router';
import { Alert, Text } from 'react-native';

import { AccountForm } from '@/components/account-form';
import { useColors } from '@/hooks/use-colors';
import { validateNickname } from '@/lib/auth';
import { changeNickname, displayName } from '@/lib/profile';
import { useSession } from '@/providers/session-provider';

export default function ChangeNicknameScreen() {
  useCatalog();
  const colors = useColors();
  const { user, profile } = useSession();

  return (
    <AccountForm
      intro={
        <>
          <Text style={{ color: colors.secondary, fontSize: 13 }}>지금 닉네임</Text>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{profile && displayName(profile)}</Text>
          <Text style={{ color: colors.secondary, fontSize: 13 }}>
            지도와 랭킹에서 다른 사람에게 보이는 이름이에요. 로그인은 계속 아이디로 해요.
          </Text>
        </>
      }
      fields={[{ key: 'nickname', placeholder: '새 닉네임 (한글·영문·숫자·_ 2~10자)' }]}
      submitLabel="닉네임 바꾸기"
      onSubmit={async ({ nickname }) => {
        if (!user) return '로그인이 필요해요.';
        const invalid = validateNickname(nickname);
        if (invalid) return invalid;
        if (nickname.trim() === profile?.nickname) return '지금 쓰는 닉네임이에요.';
        try {
          await changeNickname(user.uid, nickname);
        } catch {
          return '닉네임을 바꾸지 못했어요. 잠시 후 다시 시도해주세요.';
        }
        Alert.alert('닉네임을 바꿨어요', '', [{ text: '확인', onPress: () => router.back() }]);
        return null;
      }}
    />
  );
}
