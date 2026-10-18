import { useColorScheme } from 'react-native';

const light = {
  background: '#fff',
  surface: '#f2f2f7',
  text: '#000',
  secondary: '#8e8e93',
  border: '#e5e5ea',
  primary: '#FF5A1F',
  danger: '#ff3b30',
  silhouette: '#d1d1d6',
};

const dark: typeof light = {
  background: '#000',
  surface: '#1c1c1e',
  text: '#fff',
  secondary: '#8e8e93',
  border: '#38383a',
  primary: '#FF6B35',
  danger: '#ff453a',
  silhouette: '#3a3a3c',
};

export function useColors() {
  return useColorScheme() === 'dark' ? dark : light;
}
