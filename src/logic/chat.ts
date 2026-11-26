// Sohbet asistanı (LUMA) için istemci tarafı: /api/chat'e istek atar.
// Tipler api/chat.ts ile aynıdır; sunucu fonksiyonu kendi içinde bağımsız tutulduğu için burada tekrarlanır.
import type { SystemState } from "./types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type ChatAction =
  | { name: "spawn_object"; args: { speedKmh: number } }
  | { name: "set_night"; args: { isNight: boolean } }
  | { name: "set_paused"; args: { paused: boolean } }
  | { name: "set_time_scale"; args: { scale: 1 | 5 | 10 } }
  | { name: "reset_energy"; args: Record<string, never> };

// Sunucuya gönderilen durum: ortak veri formatı + enerji ve simülasyon bilgisi
export interface ChatState extends SystemState {
  smartWh: number;
  normalWh: number;
  simTimeSec: number;
  timeScale: number;
  paused: boolean;
}

export interface ChatReply {
  reply: string;
  actions: ChatAction[];
}

const MAX_HISTORY = 10; // sunucuya gönderilen son mesaj sayısı

export async function sendChat(messages: ChatMessage[], state: ChatState): Promise<ChatReply> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-MAX_HISTORY), state }),
    });
  } catch {
    throw new Error("Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.");
  }

  if (res.status === 404)
    throw new Error("Sohbet sunucusu bu ortamda yok (yerelde npm run dev /api'yi çalıştırmaz).");

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // cevap JSON değilse aşağıdaki genel hata gösterilir
  }
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error;
    throw new Error(message ?? `Sunucu hatası (${res.status}).`);
  }
  const data = body as Partial<ChatReply> | null;
  return { reply: data?.reply ?? "", actions: Array.isArray(data?.actions) ? data.actions : [] };
}
