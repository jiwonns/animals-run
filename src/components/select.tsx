import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useColors } from '@/hooks/use-colors';

export type SelectOption<T> = { value: T; label: string; color?: string };

type Props<T> = {
  /** Shown before the selected label, e.g. "등급". */
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
};

const MENU_GAP = 6;
const MENU_MIN_WIDTH = 160;

export function Select<T>({ label, value, options, onChange }: Props<T>) {
  const colors = useColors();
  const trigger = useRef<ComponentRef<typeof View>>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number } | null>(null);
  const selected = options.find((o) => o.value === value);
  const menuWidth = anchor ? Math.max(anchor.width, MENU_MIN_WIDTH) : 0;

  function open() {
    trigger.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y: y + height + MENU_GAP, width }));
  }

  return (
    <>
      <Pressable
        ref={trigger}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? ''}`}
        onPress={open}
        style={({ pressed }) => [styles.trigger, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
        <Text style={[styles.triggerLabel, { color: colors.secondary }]}>{label}</Text>
        <Text style={[styles.triggerValue, { color: selected?.color ?? colors.text }]}>{selected?.label}</Text>
        <Text style={[styles.caret, { color: colors.secondary }]}>▾</Text>
      </Pressable>

      <Modal
        visible={anchor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAnchor(null)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setAnchor(null)} />
        {anchor && (
          <View
            style={[
              styles.menu,
              {
                top: anchor.y,
                left: Math.max(MENU_GAP, Math.min(anchor.x, windowWidth - menuWidth - MENU_GAP)),
                width: menuWidth,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onChange(option.value);
                    setAnchor(null);
                  }}
                  style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surface }]}>
                  {option.color && <View style={[styles.dot, { backgroundColor: option.color }]} />}
                  <Text style={[styles.optionLabel, { color: colors.text }, active && styles.optionActive]}>
                    {option.label}
                  </Text>
                  {active && <Text style={[styles.check, { color: colors.primary }]}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  triggerLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  triggerValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  caret: {
    fontSize: 12,
  },
  menu: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  optionLabel: {
    fontSize: 15,
    flex: 1,
  },
  optionActive: {
    fontWeight: '800',
  },
  check: {
    fontSize: 15,
    fontWeight: '800',
  },
});
