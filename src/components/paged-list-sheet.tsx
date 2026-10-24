import { FlatList } from '@/components/refreshable';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, View, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/use-colors';

/** Open as a separate scroll surface: never nest a virtual list inside a ScrollView. */
export function PagedListSheet<T>({ title, data, keyExtractor, renderItem, onClose, columns = 1, header }: {
  title: string; data: readonly T[]; keyExtractor: (item: T) => string; renderItem: ListRenderItem<T>;
  onClose: () => void; columns?: number; header?: ReactNode;
}) {
  const c = useColors();
  const [count, setCount] = useState(24);
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
        <Text accessibilityRole="header" style={{ flex: 1, color: c.text, fontSize: 20, fontWeight: '800' }}>{title}</Text>
        <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 44, minWidth: 60, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: c.primary, fontWeight: '700' }}>닫기</Text></Pressable>
      </View>
      <FlatList data={data.slice(0, count)} keyExtractor={keyExtractor} renderItem={renderItem} numColumns={columns}
        initialNumToRender={12} maxToRenderPerBatch={12} windowSize={5} onEndReachedThreshold={0.4}
        onEndReached={() => setCount(n => Math.max(24, Math.min(data.length, n + 24)))}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
        ListHeaderComponent={header ? <>{header}</> : undefined}
        ListFooterComponent={count < data.length ? <Text style={{ color: c.secondary, textAlign: 'center', padding: 16 }}>아래로 스크롤하면 더 불러와요</Text> : undefined}
      />
    </SafeAreaView>
  </Modal>;
}
