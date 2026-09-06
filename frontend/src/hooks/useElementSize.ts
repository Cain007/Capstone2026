import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export type ElementSize = {
  width: number;
  height: number;
};

const emptySize: ElementSize = { width: 0, height: 0 };

export function useElementSize<TElement extends Element>() {
  const elementRef = useRef<TElement | null>(null);
  const [size, setSize] = useState<ElementSize>(emptySize);

  const ref = useCallback((element: TElement | null) => {
    elementRef.current = element;
  }, []);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;
    const observedElement = element;

    function measure(entry?: ResizeObserverEntry) {
      const box = entry?.contentRect ?? observedElement.getBoundingClientRect();
      setSize((current) => {
        const next = {
          width: Math.round(box.width),
          height: Math.round(box.height),
        };

        return current.width === next.width && current.height === next.height
          ? current
          : next;
      });
    }

    measure();

    const observer = new ResizeObserver((entries) => {
      measure(entries[0]);
    });
    observer.observe(observedElement);

    return () => observer.disconnect();
  }, []);

  return { ref, size };
}
