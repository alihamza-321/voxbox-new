import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAmplifierStateStore, type AmplifierKey } from '@/stores/amplifierStateStore';

type Setter<T> = (value: T | ((prev: T) => T)) => void;

type RafThrottled = {
  (): void;
  cancel: () => void;
};

const rafThrottle = (callback: () => void): RafThrottled => {
  let frameId: number | null = null;

  const wrapped = (() => {
    if (frameId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(frameId);
    }

    if (typeof window === 'undefined') {
      callback();
      return;
    }

    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      callback();
    });
  }) as RafThrottled;

  wrapped.cancel = () => {
    if (frameId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(frameId);
      frameId = null;
    }
  };

  return wrapped;
};

export const useAmplifierField = <T>(
  amplifierKey: AmplifierKey,
  fieldKey: string,
  defaultValue: T,
): readonly [T, Setter<T>] => {
  const storeValue = useAmplifierStateStore(
    useCallback(
      (state) => state.states[amplifierKey]?.formValues?.[fieldKey] as T | undefined,
      [amplifierKey, fieldKey],
    ),
  );
  const updateFormState = useAmplifierStateStore((state) => state.updateFormState);

  const [value, setValue] = useState<T>(() =>
    storeValue !== undefined ? (storeValue as T) : defaultValue,
  );

  useEffect(() => {
    if (storeValue !== undefined) {
      setValue(storeValue as T);
    }
  }, [storeValue]);

  const isSyncedRef = useRef(false);

  useEffect(() => {
    if (isSyncedRef.current) {
      return;
    }
    updateFormState(amplifierKey, { [fieldKey]: value });
    isSyncedRef.current = true;
  }, [amplifierKey, fieldKey, updateFormState, value]);

  const setPersistentValue = useCallback<Setter<T>>(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (value: T) => T)(prev) : next;
        updateFormState(amplifierKey, { [fieldKey]: resolved });
        return resolved;
      });
    },
    [amplifierKey, fieldKey, updateFormState],
  );

  return [value, setPersistentValue] as const;
};

export const useAmplifierScrollRestoration = (amplifierKey: AmplifierKey) => {
  const scrollPosition = useAmplifierStateStore(
    useCallback(
      (state) => state.states[amplifierKey]?.scrollPosition ?? 0,
      [amplifierKey],
    ),
  );
  const setScrollPosition = useAmplifierStateStore((state) => state.setScrollPosition);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (scrollPosition > 0) {
      window.scrollTo({ top: scrollPosition, behavior: 'auto' });
    }
  }, [scrollPosition]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateScroll = rafThrottle(() => setScrollPosition(amplifierKey, window.scrollY));

    const handleBeforeUnload = () => setScrollPosition(amplifierKey, window.scrollY);

    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      updateScroll.cancel();
      setScrollPosition(amplifierKey, window.scrollY);
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [amplifierKey, setScrollPosition]);
};


