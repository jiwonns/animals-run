import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RunningDot } from '@/components/running-loader';
import { useColors } from '@/hooks/use-colors';
import { validateNickname, validatePassword, validateUsername, type SignUpExtras } from '@/lib/auth';
import { parseBirthday, zodiacOf } from '@/lib/zodiac';

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

  const inputStyle = [styles.input, { backgroundColor: colors.surface, color: colors.text }];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Image source={APP_ICON} style={styles.brandIcon} />
            <Text style={[styles.brandName, { color: colors.primary }]}>Animals Run</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="아이디 (영문 소문자·숫자·_ 4~20자)"
            placeholderTextColor={colors.secondary}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            style={inputStyle}
          />
          {signUp && (
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="닉네임 (한글·영문·숫자·_ 2~10자)"
              placeholderTextColor={colors.secondary}
              autoCorrect={false}
              autoComplete="nickname"
              textContentType="nickname"
              maxLength={10}
              style={inputStyle}
            />
          )}
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호"
            placeholderTextColor={colors.secondary}
            secureTextEntry
            autoComplete={signUp ? 'new-password' : 'current-password'}
            textContentType={signUp ? 'newPassword' : 'password'}
            style={inputStyle}
            onSubmitEditing={signUp ? undefined : submit}
          />
          {signUp && (
            <>
              <TextInput
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                placeholder="비밀번호 확인"
                placeholderTextColor={colors.secondary}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                style={inputStyle}
              />
              <TextInput
                value={birthdayDigits}
                onChangeText={(text) => setBirthdayDigits(text.replace(/\D/g, '').slice(0, 8))}
                placeholder="생년월일 8자리 (예: 19990329)"
                placeholderTextColor={colors.secondary}
                keyboardType="number-pad"
                autoComplete="birthdate-full"
                maxLength={8}
                style={inputStyle}
                onSubmitEditing={submit}
              />
              {zodiac && (
                <View style={[styles.zodiac, { backgroundColor: colors.surface }]}>
                  <Image source={zodiac.image} style={styles.zodiacImage} contentFit="contain" />
                  <Text style={[styles.zodiacText, { color: colors.text }]}>
                    <Text style={styles.zodiacStrong}>{zodiac.yearName}</Text>
                    {`예요! 가입하면 노말 ${zodiac.name}을(를) 함께 드려요`}
                  </Text>
                </View>
              )}
            </>
          )}

          {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

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
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  form: {
    flexGrow: 1,
    paddingVertical: 24,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '900',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
  },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  error: {
    fontSize: 14,
  },
  zodiac: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  zodiacImage: {
    width: 40,
    height: 40,
  },
  zodiacText: {
    flex: 1,
    fontSize: 14,
  },
  zodiacStrong: {
    fontWeight: '800',
  },
  button: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
  },
});
