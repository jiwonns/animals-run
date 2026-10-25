import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AlertButton,
  type AlertOptions,
} from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';

import { useColors } from '@/hooks/use-colors';

type Dialog = {
  title: string;
  message?: string;
  buttons: AlertButton[];
  cancelable: boolean;
  onDismiss?: () => void;
};

type Tone = 'cancel' | 'neutral' | 'primary' | 'danger';

let present: ((dialog: Dialog) => void) | null = null;
const early: Dialog[] = [];

function toDialog(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): Dialog {
  return {
    title,
    message,
    buttons: buttons?.length ? buttons : [{ text: '확인' }],
    cancelable: options?.cancelable !== false,
    onDismiss: options?.onDismiss,
  };
}

export function showAppAlert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
  const dialog = toDialog(title, message, buttons, options);
  if (present) present(dialog);
  else early.push(dialog);
}

Alert.alert = showAppAlert;

function orderButtons(buttons: AlertButton[]) {
  const cancel = buttons.filter((button) => button.style === 'cancel');
  return [...cancel, ...buttons.filter((button) => button.style !== 'cancel')];
}

function toneOf(button: AlertButton, buttons: AlertButton[]): Tone {
  if (button.style === 'cancel') return 'cancel';
  if (button.style === 'destructive') return 'danger';
  const actions = buttons.filter((item) => item.style !== 'cancel' && item.style !== 'destructive');
  return actions[actions.length - 1] === button ? 'primary' : 'neutral';
}

export function AppDialogHost() {
  const colors = useColors();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const open = useRef(false);
  const pending = useRef<Dialog[]>([]);

  const show = useCallback((next: Dialog) => {
    if (open.current) {
      pending.current.push(next);
      return;
    }
    open.current = true;
    setDialog(next);
  }, []);

  useEffect(() => {
    present = show;
    Alert.alert = showAppAlert;
    while (early.length) show(early.shift()!);
    return () => {
      if (present === show) present = null;
    };
  }, [show]);

  function finish(after?: () => void) {
    open.current = false;
    setDialog(null);
    after?.();
    if (!open.current) {
      const next = pending.current.shift();
      if (next) show(next);
    }
  }

  function dismiss() {
    if (!dialog?.cancelable) return;
    const cancel = dialog.buttons.find((button) => button.style === 'cancel');
    finish(() => {
      if (cancel) cancel.onPress?.();
      else dialog.onDismiss?.();
    });
  }

  if (!dialog) return null;

  const buttons = orderButtons(dialog.buttons);
  const stacked = buttons.length > 2;
  const body = dialog.message?.trim();

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={dismiss}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="닫기" onPress={dismiss} style={StyleSheet.absoluteFill} />
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          pointerEvents="box-none"
          style={styles.center}>
          <Animated.View
            entering={ZoomIn.duration(200).springify().damping(18)}
            exiting={ZoomOut.duration(120)}
            style={[
              styles.card,
              {
                backgroundColor: colors.background,
                shadowColor: colors.text,
                borderColor: colors.border,
              },
            ]}>
            <Text style={[styles.title, { color: colors.text }]}>{dialog.title}</Text>
            {body ? <Text style={[styles.body, { color: colors.secondary }]}>{body}</Text> : null}
            <View style={[styles.actions, stacked && styles.actionsStack]}>
              {buttons.map((button, index) => {
                const tone = toneOf(button, buttons);
                const fill =
                  tone === 'primary' ? colors.primary : tone === 'danger' ? colors.danger : colors.surface;
                const label = tone === 'primary' || tone === 'danger' ? '#fff' : tone === 'cancel' ? colors.secondary : colors.text;
                return (
                  <Pressable
                    key={`${button.text ?? '확인'}:${index}`}
                    accessibilityRole="button"
                    onPress={() => finish(() => button.onPress?.())}
                    style={({ pressed }) => [
                      styles.action,
                      stacked && styles.actionStack,
                      { backgroundColor: fill, opacity: pressed ? 0.86 : 1 },
                    ]}>
                    <Text style={[styles.actionLabel, { color: label }]}>{button.text || '확인'}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#1A120D99',
  },
  center: { alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    padding: 22,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  title: { fontSize: 19, fontWeight: '900', lineHeight: 26, textAlign: 'center' },
  body: { fontSize: 15, fontWeight: '600', lineHeight: 22, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionsStack: { flexDirection: 'column' },
  action: { flex: 1, minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  actionStack: { flex: undefined, width: '100%' },
  actionLabel: { fontSize: 16, fontWeight: '800' },
});
