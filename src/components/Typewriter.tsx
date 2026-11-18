// Texte « tapé à la machine » : apparaît lettre par lettre avec le cliquetis des touches.

import { useEffect, useState } from 'preact/hooks';
import { typeClick } from '../audio/sfx';
import { reducedMotion } from '../state/prefs';

interface Props {
  text: string;
  /** Délai avant de commencer (ms). */
  delay?: number;
  /** Millisecondes par caractère. */
  speed?: number;
  sound?: boolean;
  class?: string;
  onDone?: () => void;
}

export function Typewriter({ text, delay = 0, speed = 35, sound = true, class: cls, onDone }: Props) {
  const instant = reducedMotion.value;
  const [count, setCount] = useState(instant ? text.length : 0);

  useEffect(() => {
    if (instant) {
      setCount(text.length);
      onDone?.();
      return;
    }
    setCount(0);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i++;
      setCount(i);
      if (sound && text[i - 1] !== ' ' && i % 2 === 1) typeClick();
      if (i < text.length) timer = setTimeout(tick, speed * (0.6 + Math.random() * 0.8));
      else onDone?.();
    };
    timer = setTimeout(tick, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, instant]);

  return (
    <span class={cls} aria-label={text}>
      <span aria-hidden="true">{text.slice(0, count)}</span>
      {count < text.length && <span class="tw-caret" aria-hidden="true" />}
    </span>
  );
}
