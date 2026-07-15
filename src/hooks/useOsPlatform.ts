import { useMemo } from 'react';
import { platform } from '../utils/tauri-mocks';

export function useOsPlatform() {
  return useMemo(() => {
    try {
      return platform();
    } catch (_error) {
      return '';
    }
  }, []);
}
