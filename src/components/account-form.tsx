import { ScrollView } from '@/components/refreshable';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { RunningDot } from '@/components/running-loader';
import { useColors } from '@/hooks/use-colors';

type Field = {
  key: string;
  placeholder: string;
  secure?: boolean;
};

/** A short account form (change id, password, leave) that shows the error its submit resolves to. */
export function AccountForm({ intro, fields, submitLabel, danger = false, onSubmit }: {
  intro?: ReactNode;
  fields: Field[];
  submitLabel: string;
  danger?: boolean;
  /** Resolves to an error message, or null on success. */
  onSubmit: (values: Record<string, string>) => Promise<string | null>;
}) {
  const colors = useColors();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const ready = fields.every((f) => values[f.key]);

  async function submit() {
    if (!ready || submitting) return;
    setError(null);
    setSubmitting(true);
    const message = await onSubmit(values);
    setSubmitting(false);
    if (message) setError(message);
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}>
      {intro && <View style={[styles.intro, { backgroundColor: colors.surface }]}>{intro}</View>}
      {fields.map((field, index) => (
        <TextInput
          key={field.key}
          value={values[field.key] ?? ''}
          onChangeText={(text) => setValues((v) => ({ ...v, [field.key]: text }))}
          placeholder={field.placeholder}
          placeholderTextColor={colors.secondary}
          secureTextEntry={field.secure}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={index === fields.length - 1 ? 'done' : 'next'}
          onSubmitEditing={index === fields.length - 1 ? submit : undefined}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
        />
      ))}
      {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
      <Pressable
        accessibilityRole="button"
        disabled={!ready || submitting}
        onPress={submit}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: !ready ? colors.border : danger ? colors.danger : colors.primary },
          pressed && styles.pressed,
        ]}>
        {submitting ? (
          <RunningDot />
        ) : (
          <Text style={[styles.buttonLabel, !ready && { color: colors.secondary }]}>{submitLabel}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 12,
  },
  intro: {
    borderRadius: 14,
    padding: 14,
    gap: 6,
    marginBottom: 4,
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
  pressed: {
    opacity: 0.8,
  },
});
