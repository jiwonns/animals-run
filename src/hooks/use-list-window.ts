import { useState } from 'react';

/** Local data (inventory/relationships) is already synced; only expose one rendering page at a time. */
export function useListWindow<T>(items: readonly T[], resetKey: string, pageSize = 24) {
  const [state, setState] = useState({ key: resetKey, count: pageSize });
  const count = state.key === resetKey ? state.count : pageSize;
  return { data: items.slice(0, count), hasMore: items.length > count,
    loadMore: () => setState({ key: resetKey, count: Math.max(pageSize, Math.min(items.length, count + pageSize)) }) };
}
