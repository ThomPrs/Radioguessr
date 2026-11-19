// Chat du salon, façon carnet de télégrammes : papier bristol ligné, texte tapé à la machine,
// nom de l'expéditeur dans son encre. Le texte est rendu comme du texte (jamais comme du HTML).

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { CHAT_MAX_LENGTH, PLAYER_COLORS, type ChatMessage } from '../../shared/duel';
import { clickSound } from '../audio/sfx';
import type { DuelSession } from '../duel/session';
import { t } from '../i18n/fr';
import { ReactionBar } from './ReactionBar';

function time(at: number): string {
  return new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function ChatPanel({ session }: { session: DuelSession }) {
  const messages = session.chat.value;
  const error = session.chatError.value;
  const me = session.id.playerId;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(true);
  const [seen, setSeen] = useState(0);
  const list = useRef<HTMLOListElement>(null);
  const stick = useRef(true); // reste collé en bas tant que l'utilisateur n'est pas remonté lire

  const lastId = messages.at(-1)?.id ?? 0;
  const unread = open ? 0 : messages.filter((m) => m.id > seen && m.pid !== me).length;

  useEffect(() => {
    if (open) setSeen(lastId);
  }, [open, lastId]);

  useLayoutEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, open]);

  async function submit(e: Event) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    clickSound();
    if (await session.sendChat(value)) setText('');
    setSending(false);
  }

  return (
    <section class={`chat-panel${open ? '' : ' is-closed'}`} aria-label={t.chat.title}>
      <button class="chat-header" onClick={() => setOpen((o) => !o)} aria-expanded={open} title={t.chat.toggle}>
        <span class="chat-title">{t.chat.title}</span>
        {unread > 0 && <span class="chat-unread">{t.chat.unread(unread)}</span>}
        <span class="chat-chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <>
          <ol
            class="chat-list"
            ref={list}
            aria-live="polite"
            onScroll={(e) => {
              const el = e.currentTarget;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            }}
          >
            {messages.length === 0 && <li class="chat-empty">{t.chat.empty}</li>}
            {messages.map((m) => (
              <Message key={m.id} m={m} mine={m.pid === me} />
            ))}
          </ol>

          <ReactionBar session={session} />
          <form class="chat-form" onSubmit={(e) => void submit(e)}>
            <input
              type="text"
              value={text}
              maxLength={CHAT_MAX_LENGTH}
              placeholder={t.chat.placeholder}
              aria-label={t.chat.label}
              autoComplete="off"
              onInput={(e) => setText(e.currentTarget.value)}
            />
            <button type="submit" class="chat-send" disabled={!text.trim() || sending}>
              {t.chat.send}
            </button>
          </form>
          {error && <p class="chat-error">{t.duel.errors[error] ?? t.duel.errors.server}</p>}
          {text.length > CHAT_MAX_LENGTH - 40 && (
            <p class="chat-count">
              {text.length} / {CHAT_MAX_LENGTH}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Message({ m, mine }: { m: ChatMessage; mine: boolean }) {
  if (m.kind === 'system') {
    return (
      <li class="chat-msg is-system">
        <span class="chat-time">{time(m.at)}</span> — {m.text}
      </li>
    );
  }
  return (
    <li class={`chat-msg${mine ? ' is-mine' : ''}`}>
      <span class="chat-time">{time(m.at)}</span>{' '}
      <strong class="chat-author" style={{ color: PLAYER_COLORS[m.color] }}>
        {m.name}
      </strong>{' '}
      <span class="chat-text">{m.text}</span>
    </li>
  );
}
