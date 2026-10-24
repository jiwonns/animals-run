import { ScrollView } from '@/components/refreshable';
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, ICONS } from '@/components/icon';
import { RunningDot } from '@/components/running-loader';
import { useColors } from '@/hooks/use-colors';
import { validateNickname, validatePassword, validateUsername, type SignUpExtras } from '@/lib/auth';
import { parseBirthday, zodiacOf } from '@/lib/zodiac';
import { useSession } from '@/providers/session-provider';

const PUPPY = require('../../assets/images/splash-icon.png');
const ACCENT = '#FB7103';

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
  const { width, height } = useWindowDimensions();
  const mark = Math.round(Math.min(width * 0.34, height * (signUp ? 0.12 : 0.18), signUp ? 96 : 132));
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={[styles.sun, { top: -height * 0.1, right: -width * 0.2 }]} />
      <View pointerEvents="none" style={[styles.hill, { bottom: -width * 0.34, left: -width * 0.28 }]} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.form, signUp ? styles.formSignup : styles.formLogin]}
          keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(420)} style={styles.hero}>
            <View style={[styles.heroMark, { width: mark + 20, height: mark + 16 }]}>
              <View style={[styles.glow, { width: mark * 0.88, height: mark * 0.88, borderRadius: mark }]} />
              <Image source={PUPPY} style={{ width: mark, height: mark, zIndex: 1 }} contentFit="contain" />
            </View>
            <Text style={styles.eyebrow}>EVERY STEP, A NEW FRIEND</Text>
            <Text style={styles.brand} allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit>
              Animals <Text style={styles.run}>Run</Text>
            </Text>
            <View style={styles.rule} />
            <Text style={styles.tagline}>걷고, 만나고, 함께 자라요</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(420).delay(80)} style={styles.card}>
            <View style={styles.heading}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>
                {signUp ? '새로운 친구들과 함께 달려볼까요?' : '다시 만나 반가워요. 모험을 이어가요!'}
              </Text>
            </View>

            <Field
              label="아이디"
              value={username}
              onChangeText={setUsername}
              placeholder="영문 소문자·숫자·_ 4~20자"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
            />
            {signUp ? (
              <Field
                label="닉네임"
                value={nickname}
                onChangeText={setNickname}
                placeholder="한글·영문·숫자·_ 2~10자"
                autoCorrect={false}
                autoComplete="nickname"
                textContentType="nickname"
                maxLength={10}
              />
            ) : null}
            <Field
              label="비밀번호"
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호를 입력해주세요"
              secureTextEntry={!showPassword}
              autoComplete={signUp ? 'new-password' : 'current-password'}
              textContentType={signUp ? 'newPassword' : 'password'}
              onSubmitEditing={signUp ? undefined : submit}
              secret={{ shown: showPassword, onToggle: () => setShowPassword((value) => !value) }}
            />
            {signUp ? (
              <>
                <Field
                  label="비밀번호 확인"
                  value={passwordConfirm}
                  onChangeText={setPasswordConfirm}
                  placeholder="비밀번호를 한 번 더 입력해주세요"
                  secureTextEntry={!showConfirm}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  secret={{ shown: showConfirm, onToggle: () => setShowConfirm((value) => !value) }}
                />
                <Field
                  label="생년월일"
                  value={birthdayDigits}
                  onChangeText={(text) => setBirthdayDigits(text.replace(/\D/g, '').slice(0, 8))}
                  placeholder="8자리 숫자 (예: 19990329)"
                  keyboardType="number-pad"
                  autoComplete="birthdate-full"
                  maxLength={8}
                  onSubmitEditing={submit}
                />
                {zodiac ? (
                  <View style={styles.zodiac}>
                    <Image source={zodiac.image} style={styles.zodiacImage} contentFit="contain" />
                    <Text style={styles.zodiacText}>
                      <Text style={styles.zodiacStrong}>{zodiac.yearName}</Text>
                      {`예요! 가입하면 노말 ${zodiac.name}을(를) 함께 드려요`}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}

            {error || notice ? <Text style={[styles.error, { color: colors.danger }]}>{error || notice}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={submit}
              style={({ pressed }) => [styles.button, { opacity: submitting ? 0.65 : pressed ? 0.88 : 1 }]}>
              {submitting ? <RunningDot /> : <Text style={styles.buttonLabel}>{submitLabel}</Text>}
            </Pressable>
          </Animated.View>

          <View style={styles.footer}>{footer}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  secret,
  ...input
}: TextInputProps & { label: string; secret?: { shown: boolean; onToggle: () => void } }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputFocus]}>
        <TextInput
          {...input}
          placeholderTextColor="#C4A994"
          accessibilityLabel={label}
          onFocus={(event) => {
            setFocused(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
          style={styles.input}
        />
        {secret ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={secret.shown ? `${label} 숨기기` : `${label} 보기`}
            onPress={secret.onToggle}
            hitSlop={8}
            style={styles.secret}>
            <Icon name={secret.shown ? ICONS.hidden : ICONS.visible} size={20} color={focused ? ACCENT : '#B08970'} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF3E7' },
  flex: { flex: 1 },
  sun: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#FFD7B0',
    opacity: 0.5,
  },
  hill: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#F4D2B0',
    opacity: 0.4,
  },
  form: { flexGrow: 1, paddingBottom: 28, paddingHorizontal: 22, gap: 18, maxWidth: 480, width: '100%', alignSelf: 'center' },
  formLogin: { justifyContent: 'center', paddingTop: 12 },
  formSignup: { justifyContent: 'flex-start', paddingTop: 8 },
  hero: { alignItems: 'center', gap: 6 },
  heroMark: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  glow: { position: 'absolute', alignSelf: 'center', backgroundColor: '#FFE9CF' },
  eyebrow: { marginTop: 4, fontSize: 10, letterSpacing: 2.2, color: '#C4844E', fontWeight: '800' },
  brand: { fontSize: 30, letterSpacing: -1, fontWeight: '900', color: '#5C3324' },
  run: { color: ACCENT },
  rule: { width: 32, height: 3, borderRadius: 99, backgroundColor: ACCENT, opacity: 0.85, marginTop: 2 },
  tagline: { color: '#A07155', fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: '#FFFCF8',
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#F3DCC8',
  },
  heading: { gap: 4, marginBottom: 2 },
  title: { fontSize: 22, fontWeight: '900', color: '#5C3324' },
  subtitle: { fontSize: 13, color: '#A07155', fontWeight: '500', lineHeight: 18 },
  field: { gap: 7 },
  fieldLabel: { color: '#7A5846', fontSize: 12, fontWeight: '800', marginLeft: 2 },
  inputWrap: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F2',
    borderWidth: 1.5,
    borderColor: '#EED8C4',
  },
  inputFocus: { borderColor: ACCENT, backgroundColor: '#FFF' },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#5C3324' },
  secret: { paddingLeft: 8, minHeight: 44, justifyContent: 'center' },
  error: { fontSize: 13, lineHeight: 19 },
  zodiac: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF4E8',
    borderWidth: 1,
    borderColor: '#F3D6B8',
  },
  zodiacImage: { width: 44, height: 44 },
  zodiacText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#5C3324' },
  zodiacStrong: { fontWeight: '800', color: ACCENT },
  button: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    backgroundColor: ACCENT,
  },
  buttonLabel: { color: '#fff', fontSize: 16, fontWeight: '800' },
  footer: { alignItems: 'center', paddingTop: 2 },
});
