import { ScrollView } from '@/components/refreshable';
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, ICONS } from '@/components/icon';
import { RunningDot } from '@/components/running-loader';
import { useColors } from '@/hooks/use-colors';
import { validateNickname, validatePassword, validateUsername, type SignUpExtras } from '@/lib/auth';
import { parseBirthday, zodiacOf } from '@/lib/zodiac';
import { useSession } from '@/providers/session-provider';

const APP_ICON = require('../../assets/images/icon.png');

type Props = {
  title: string;
  submitLabel: string;
  /** Sign-up: asks for a nickname, the password twice and a birthday. */
  signUp?: boolean;
  /** Resolves to an error message, or null on success. `extras` (birthday as YYYY-MM-DD) only for sign-up. */
  onSubmit: (username: string, password: string, extras: SignUpExtras) => Promise<string | null>;
  footer: ReactNode;
};

export function AuthForm({ title, submitLabel, signUp = false, onSubmit, footer }: Props) {
  const colors = useColors();
  const { notice } = useSession();
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [birthdayDigits, setBirthdayDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const birthday = parseBirthday(birthdayDigits);
  const zodiac = birthday ? zodiacOf(birthday) : null;

  async function submit() {
    const validationError =
      validateUsername(username) ??
      (signUp ? validateNickname(nickname) : null) ??
      validatePassword(password) ??
      (signUp && password !== passwordConfirm ? '비밀번호가 서로 달라요.' : null) ??
      (signUp && !birthday ? '생년월일 8자리를 바르게 입력해주세요. (예: 19990329)' : null);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    const submitError = await onSubmit(username, password, { birthday: birthday ?? '', nickname });
    setSubmitting(false);
    if (submitError) setError(submitError);
  }

  const inputStyle = styles.input;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.halo} />
            <View style={styles.brandSeal}><Image source={APP_ICON} style={styles.brandIcon} /></View>
            <View style={styles.brandPaw}><Icon name={ICONS.character} size={20} color="#C98860" /></View>
            <Text style={styles.brandName}>Animals Run</Text>
            <Text style={styles.brandTagline}>걷고, 만나고, 함께 자라요</Text>
          </View>
          <View style={styles.heading}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{signUp ? '새로운 친구들과 함께 달려볼까요?' : '다시 만나 반가워요. 모험을 이어가요!'}</Text>
          </View>

          <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>아이디</Text><TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="영문 소문자·숫자·_ 4~20자"
            placeholderTextColor="#B7A79C"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            style={inputStyle}
          /></View>
          {signUp && (
            <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>닉네임</Text><TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="한글·영문·숫자·_ 2~10자"
              placeholderTextColor="#B7A79C"
              autoCorrect={false}
              autoComplete="nickname"
              textContentType="nickname"
              maxLength={10}
              style={inputStyle}
            /></View>
          )}
          <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>비밀번호</Text><TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호를 입력해주세요"
            placeholderTextColor="#B7A79C"
            secureTextEntry
            autoComplete={signUp ? 'new-password' : 'current-password'}
            textContentType={signUp ? 'newPassword' : 'password'}
            style={inputStyle}
            onSubmitEditing={signUp ? undefined : submit}
          /></View>
          {signUp && (
            <>
              <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>비밀번호 확인</Text><TextInput
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                placeholder="비밀번호를 한 번 더 입력해주세요"
                placeholderTextColor="#B7A79C"
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                style={inputStyle}
              /></View>
              <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>생년월일</Text><TextInput
                value={birthdayDigits}
                onChangeText={(text) => setBirthdayDigits(text.replace(/\D/g, '').slice(0, 8))}
                placeholder="8자리 숫자 (예: 19990329)"
                placeholderTextColor="#B7A79C"
                keyboardType="number-pad"
                autoComplete="birthdate-full"
                maxLength={8}
                style={inputStyle}
                onSubmitEditing={submit}
              /></View>
              {zodiac && (
                <View style={styles.zodiac}>
                  <Image source={zodiac.image} style={styles.zodiacImage} contentFit="contain" />
                  <Text style={styles.zodiacText}>
                    <Text style={styles.zodiacStrong}>{zodiac.yearName}</Text>
                    {`예요! 가입하면 노말 ${zodiac.name}을(를) 함께 드려요`}
                  </Text>
                </View>
              )}
            </>
          )}

          {(error || notice) && <Text style={[styles.error, { color: colors.danger }]}>{error || notice}</Text>}

          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={submit}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.primary, opacity: submitting ? 0.6 : pressed ? 0.8 : 1 },
            ]}>
            {submitting ? (
              <RunningDot />
            ) : (
              <Text style={styles.buttonLabel}>{submitLabel}</Text>
            )}
          </Pressable>

          <View style={styles.footer}>{footer}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF6ED' },
  flex: { flex: 1 },
  form: {
    flexGrow: 1, paddingTop: 24, paddingBottom: 28, justifyContent: 'center', paddingHorizontal: 22,
    gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center',
  },
  hero: { alignItems: 'center', paddingBottom: 4, gap: 4 },
  halo: { position: 'absolute', top: 3, width: 108, height: 108, borderRadius: 54, backgroundColor: '#FFE4D1' },
  brandSeal: {
    width: 96, height: 96, alignItems: 'center', justifyContent: 'center', borderRadius: 48,
    backgroundColor: '#FFFCF8', borderWidth: 1, borderColor: '#F3D6C2', marginBottom: 5,
  },
  brandPaw: {
    position: 'absolute', right: '28%', top: 68, width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#FFF6ED', alignItems: 'center', justifyContent: 'center',
  },
  brandIcon: { width: 80, height: 80, borderRadius: 24 },
  brandName: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, color: '#634331' },
  brandTagline: { color: '#A88870', fontSize: 12, fontWeight: '600', marginBottom: 7 },
  heading: { gap: 5, marginTop: 1, marginBottom: 1 },
  title: { fontSize: 25, fontWeight: '900', color: '#503B30' },
  subtitle: { fontSize: 13, color: '#9B8170', fontWeight: '500' },
  fieldGroup: { gap: 7 },
  fieldLabel: { color: '#705A4B', fontSize: 12, fontWeight: '800', marginLeft: 3 },
  input: {
    height: 54, borderRadius: 15, paddingHorizontal: 15, fontSize: 15, color: '#503B30',
    backgroundColor: '#FFFEFC', borderWidth: 1, borderColor: '#F0DFD1', shadowColor: '#775139',
    shadowOpacity: 0.035, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  error: { fontSize: 13, lineHeight: 19 },
  zodiac: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#FFFCF8', borderWidth: 1, borderColor: '#F3E4D8',
  },
  zodiacImage: { width: 40, height: 40 },
  zodiacText: { flex: 1, fontSize: 14, color: '#634331' },
  zodiacStrong: { fontWeight: '800' },
  button: {
    height: 56, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 1,
    shadowColor: '#D64D1C', shadowOpacity: 0.2, shadowRadius: 11, shadowOffset: { width: 0, height: 6 },
  },
  buttonLabel: { color: '#fff', fontSize: 17, fontWeight: '700' },
  footer: { alignItems: 'center', marginTop: 0 },
});
