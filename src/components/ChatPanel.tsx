import { useEffect, useRef, useState } from "react";
import { sendChat, type ChatAction, type ChatMessage, type ChatState } from "../logic/chat";
import "./ChatPanel.css";

// Sağ altta açılan sohbet paneli: doğal dille simülasyonu yönetir ve enerji sorularını cevaplar.
// Asistanın komutları (araç çağrıları) onAction ile simülasyona uygulanır.

interface UiMessage extends ChatMessage {
  actions?: ChatAction[];
  error?: boolean;
}

interface Props {
  state: ChatState;
  onAction: (action: ChatAction) => void;
}

const SUGGESTIONS = [
  "Gece yap ve 70 km/s hızla bir araç gönder",
  "Şu ana kadar ne kadar tasarruf ettik?",
  "Neden önden birden fazla lamba yanıyor?",
];

const MAX_CHARS = 500;

function actionLabel(a: ChatAction): string {
  switch (a.name) {
    case "spawn_object":
      return `${a.args.speedKmh > 7 ? "🚗" : "🚶"} ${a.args.speedKmh} km/s`;
    case "set_night":
      return a.args.isNight ? "🌙 Gece" : "☀️ Gündüz";
    case "set_paused":
      return a.args.paused ? "⏸️ Duraklatıldı" : "▶️ Devam";
    case "set_time_scale":
      return `⏩ ${a.args.scale}x`;
    case "reset_energy":
      return "🔄 Enerji sıfırlandı";
  }
}

export function ChatPanel({ state, onAction }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Yeni mesajda en alta kaydır
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next: UiMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      // Hata mesajları sunucuya gönderilmez
      const history = next.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
      const { reply, actions } = await sendChat(history, state);
      actions.forEach(onAction);
      setMessages((prev) => [...prev, { role: "assistant", content: reply, actions }]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Bilinmeyen bir hata oluştu.";
      setMessages((prev) => [...prev, { role: "assistant", content: message, error: true }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button className="chat-toggle" onClick={() => setOpen(true)} aria-label="Asistanı aç">
        💬 LUMA
      </button>
    );
  }

  return (
    <aside className="chat-panel" aria-label="LUMA sohbet paneli">
      <header>
        <strong>LUMA</strong>
        <span>yapay zekâ asistanı</span>
        <button onClick={() => setOpen(false)} aria-label="Kapat">
          ✕
        </button>
      </header>

      <div className="chat-messages" ref={listRef}>
        <div className="chat-msg assistant">
          Merhaba, ben LUMA. Simülasyonu benimle yönetebilir, enerji tasarrufunu sorabilirsin.
        </div>
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}${m.error ? " error" : ""}`}>
            {m.content}
            {m.actions && m.actions.length > 0 && (
              <div className="chat-actions">
                {m.actions.map((a, j) => (
                  <span key={j}>{actionLabel(a)}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="chat-msg assistant typing">LUMA düşünüyor…</div>}
      </div>

      {messages.length === 0 && (
        <div className="chat-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} disabled={loading}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          ref={inputRef}
          value={input}
          maxLength={MAX_CHARS}
          placeholder="Örn. gündüze geç"
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading || input.trim() === ""}>
          Gönder
        </button>
      </form>
    </aside>
  );
}
