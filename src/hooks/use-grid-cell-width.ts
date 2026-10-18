import { useWindowDimensions } from 'react-native';

/** Width of one cell in a full-width grid; floored so rounding never pushes the last column onto a new row. */
export function useGridCellWidth(columns: number, padding: number, gap: number) {
  const { width } = useWindowDimensions();
  return Math.floor((width - padding * 2 - gap * (columns - 1)) / columns);
}
