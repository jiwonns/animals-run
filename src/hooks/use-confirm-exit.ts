import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, BackHandler, Platform } from 'react-native';

/** On Android, asks before the back button closes the app from a top-level screen. */
export function useConfirmExit() {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert('앱 종료', '정말 종료하시겠어요?', [
          { text: '취소', style: 'cancel' },
          { text: '종료', style: 'destructive', onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      });
      return () => subscription.remove();
    }, []),
  );
}
