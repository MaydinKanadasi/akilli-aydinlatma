// Vercel sunucu fonksiyonu: POST /api/chat
//
// Web arayüzündeki sohbet paneli ve Unity'deki LUMA aynı fonksiyona istek atar.
// İstek: { messages: [{ role, content }], state: { ...anlık durum } }
// Cevap: { reply: string, actions: [{ name, args }] }
// LLM ya cevap yazar ya da araç (tool) çağırır; araçları istemci (web / Unity) uygular.
//
// API anahtarı yalnızca ortam değişkeninde durur (GROQ_API_KEY); repo açık olduğu için koda yazılmaz.
// Servis LLM_PROVIDER ile değiştirilebilir: "groq" (varsayılan) ya da "gemini".
// Bu dosya kendi içinde bağımsızdır (src/ içinden bir şey içe aktarmaz).

type Role = "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
}

interface SimObject {
  type: "pedestrian" | "car";
  speedKmh: number;
  position: number;
}

interface SimState {
  source?: string;
  isNight: boolean;
  object: SimObject | null;
  lamps: number[];
  powerW: number;
  normalPowerW: number;
  smartWh: number; // akıllı sistemin biriken tüketimi
  normalWh: number; // aynı sürede normal sistemin tüketimi
  simTimeSec: number; // simülasyon süresi
  timeScale: number;
  paused: boolean;
}

export type ChatAction =
  | { name: "spawn_object"; args: { speedKmh: number } }
  | { name: "set_night"; args: { isNight: boolean } }
  | { name: "set_paused"; args: { paused: boolean } }
  | { name: "set_time_scale"; args: { scale: 1 | 5 | 10 } }
  | { name: "reset_energy"; args: Record<string, never> };

export interface ChatResponse {
  reply: string;
  actions: ChatAction[];
  model?: string; // cevabı üreten model (teşhis için)
}

// ---------- Ayarlar ----------

const PROVIDERS = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
    // Varsayılan model hesapta yoksa sırayla denenir (Groq üretim modelleri, Kasım 2026)
    fallbackModels: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"],
  },
  gemini: {
    // Gemini'nin OpenAI uyumlu uç noktası; model adı kullanım anında kontrol edilmeli
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-2.5-flash",
    fallbackModels: ["gemini-2.5-flash-lite"],
  },
} as const;

const MAX_BODY_BYTES = 32_000;
const MAX_MESSAGES = 10; // LLM'e gönderilen son mesaj sayısı
const MAX_MESSAGE_CHARS = 500;
const RATE_PER_IP_PER_MIN = 10;
const RATE_GLOBAL_PER_MIN = 25; // Groq ücretsiz katmanı dakikada 30 istek civarında
const LLM_TIMEOUT_MS = 20_000;
const MIN_SPEED = 1;
const MAX_SPEED = 150;

// ---------- Araç tanımları (OpenAI uyumlu biçim) ----------

// LLM'e tek bir araç verilir; tüm alanlar isteğe bağlıdır. Böylece "gece yap ve araç gönder" gibi
// birden fazla komut, paralel araç çağrısını desteklemeyen modellerde de tek çağrıyla yapılır.
// Sunucu bu çağrıyı istemcinin uyguladığı komutlara (spawn_object, set_night, ...) çevirir.
const TOOL_NAME = "simulasyonu_ayarla";

const TOOLS = [
  {
    type: "function",
    function: {
      name: TOOL_NAME,
      description:
        "Simülasyona komut verir. Yalnızca kullanıcının istediği alanları doldur, diğerlerini hiç yazma.",
      parameters: {
        type: "object",
        properties: {
          isNight: { type: "boolean", description: "true = geceye geç, false = gündüze geç (gündüz lambalar kapalı)" },
          paused: { type: "boolean", description: "true = duraklat, false = devam ettir" },
          timeScale: { type: "integer", enum: [1, 5, 10], description: "Simülasyon hız çarpanı" },
          resetEnergy: { type: "boolean", description: "true = biriken enerji sayaçlarını sıfırla" },
          spawnSpeedKmh: {
            type: "number",
            description: `Yola bu hızla yeni nesne gönder (km/s, ${MIN_SPEED}–${MAX_SPEED}); 7 ve altı yaya, üstü araç`,
          },
        },
      },
    },
  },
];

// ---------- İstek sınırı (sunucu örneği başına, bellekte) ----------

const hitsByIp = new Map<string, number[]>();
let globalHits: number[] = [];

function rateLimited(ip: string, now: number): boolean {
  const windowStart = now - 60_000;
  globalHits = globalHits.filter((t) => t > windowStart);
  const ipHits = (hitsByIp.get(ip) ?? []).filter((t) => t > windowStart);
  if (ipHits.length >= RATE_PER_IP_PER_MIN || globalHits.length >= RATE_GLOBAL_PER_MIN) {
    hitsByIp.set(ip, ipHits);
    return true;
  }
  ipHits.push(now);
  globalHits.push(now);
  hitsByIp.set(ip, ipHits);
  // Bellek büyümesin diye eski IP kayıtlarını temizle
  if (hitsByIp.size > 1000) {
    for (const [key, hits] of hitsByIp) if (hits.every((t) => t <= windowStart)) hitsByIp.delete(key);
  }
  return false;
}

// Testler için
export function _resetRateLimit(): void {
  hitsByIp.clear();
  globalHits = [];
}

// ---------- Yardımcılar ----------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function error(message: string, status: number): Response {
  return json({ error: message }, status);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function parseRequest(raw: unknown): { messages: ChatMessage[]; state: SimState } | string {
  if (typeof raw !== "object" || raw === null) return "Geçersiz istek.";
  const { messages, state } = raw as { messages?: unknown; state?: unknown };

  if (!Array.isArray(messages) || messages.length === 0) return "Mesaj yok.";
  const clean: ChatMessage[] = [];
  for (const m of messages.slice(-MAX_MESSAGES)) {
    const { role, content } = (m ?? {}) as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return "Geçersiz mesaj.";
    if (role === "user" && content.length > MAX_MESSAGE_CHARS)
      return `Mesaj en fazla ${MAX_MESSAGE_CHARS} karakter olabilir.`;
    clean.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS * 2) });
  }
  if (clean[clean.length - 1].role !== "user") return "Son mesaj kullanıcıdan olmalı.";
  if (clean[clean.length - 1].content.trim() === "") return "Mesaj boş.";

  if (typeof state !== "object" || state === null) return "Durum bilgisi yok.";
  const s = state as Partial<SimState>;
  if (
    typeof s.isNight !== "boolean" ||
    !Array.isArray(s.lamps) ||
    !isFiniteNumber(s.powerW) ||
    !isFiniteNumber(s.normalPowerW) ||
    !isFiniteNumber(s.smartWh) ||
    !isFiniteNumber(s.normalWh) ||
    !isFiniteNumber(s.simTimeSec) ||
    !isFiniteNumber(s.timeScale) ||
    typeof s.paused !== "boolean"
  )
    return "Durum bilgisi eksik.";

  return { messages: clean, state: s as SimState };
}

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// LLM'in hesap hatası yapmaması için türetilmiş değerler sunucuda hesaplanır
function stateSummary(s: SimState) {
  const savedWh = s.normalWh - s.smartWh;
  const savingsPct = s.normalWh > 0 ? (savedWh / s.normalWh) * 100 : null;
  return {
    kaynak: s.source ?? "bilinmiyor",
    gece: s.isNight,
    yoldakiNesne: s.object
      ? {
          tur: s.object.type === "car" ? "araç" : "yaya",
          hizKmh: round(s.object.speedKmh, 1),
          konumLamba: round(s.object.position, 2),
        }
      : null,
    lambalarYuzde: s.lamps,
    anlikGucW: { akilli: round(s.powerW, 1), normal: round(s.normalPowerW, 1) },
    birikenEnerjiWh: {
      akilli: round(s.smartWh, 3),
      normal: round(s.normalWh, 3),
      tasarruf: round(savedWh, 3),
      tasarrufYuzde: savingsPct === null ? null : round(savingsPct, 1),
    },
    simulasyonSuresiSn: round(s.simTimeSec, 1),
    zamanCarpani: s.timeScale,
    duraklatildi: s.paused,
  };
}

function systemPrompt(s: SimState): string {
  return `Sen LUMA'sın: akıllı sokak aydınlatması simülasyonunun asistanı. Her zaman Türkçe, kısa (en fazla 3 cümle) ve samimi cevap ver.
Cevabı düz metin olarak yaz: Markdown (**, #, liste işaretleri) kullanma. Sayıları Türkçe biçimde yaz (ondalık ayırıcı virgül: 68,06 Wh, %99,1).

Sistem: ESP32 tabanlı, 5 sokak lambası, lambalar arası 30 m, lamba gücü %100'de 100 W. Lambalar PWM ile (5 kHz, 8 bit) kısılır.
Kurallar:
1. Gündüz tüm lambalar kapalı.
2. Gece yolda nesne yoksa tüm lambalar kapalı.
3. Nesnenin bulunduğu lamba %100.
4. Öndeki lambalar %40 ve %20. Araçta, aracın 3 saniyede ulaşacağı lambalar önceden %100 (en fazla 4).
5. Hemen arkadaki lamba %20, daha gerisi kapalı.
6. 7 km/s üstü araç, altı yaya sayılır.
"Normal sistem" gece tüm lambaları %100 yakar (500 W). Tasarruf, akıllı sistemin normal sisteme göre harcamadığı enerjidir.

Komutlar için ${TOOL_NAME} aracını kullan:
- Bir mesajdaki bütün komutları tek çağrıda, ilgili alanları doldurarak ver (örneğin "gece yap ve 70 ile araç gönder" → isNight: true, spawnSpeedKmh: 70).
- Yaya için hız verilmezse 5 km/s, araç için 50 km/s kullan. Hız ${MIN_SPEED}–${MAX_SPEED} km/s aralığında olmalı.
- Zaman çarpanı yalnızca 1, 5 ya da 10 olabilir.
- Soru soruluyorsa (komut yoksa) aracı çağırma, yalnızca cevap yaz.
Enerji ve durum sorularında yalnızca aşağıdaki güncel verileri kullan, sayı uydurma. Konum lamba cinsindendir (1 = 1. lambanın hizası, 0 = yol girişi, 6 = çıkış).
Proje dışı sorulara kibarca yalnızca bu simülasyon hakkında yardım edebildiğini söyle.

Güncel durum (JSON):
${JSON.stringify(stateSummary(s))}`;
}

// Tek araç çağrısını sırayla uygulanacak komutlara çevirir: önce ortam ve zaman, en son nesne gönderme.
// Geçersiz alanlar atılır.
function toActions(name: string, rawArgs: string | undefined): ChatAction[] {
  if (name !== TOOL_NAME) {
    // Model eski tekil araç adlarından birini uydurursa onu da kabul et
    const single = toAction(name, rawArgs);
    return single ? [single] : [];
  }
  let a: Record<string, unknown>;
  try {
    a = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return [];
  }
  const out: (ChatAction | null)[] = [
    "isNight" in a ? toAction("set_night", JSON.stringify({ isNight: a.isNight })) : null,
    "paused" in a ? toAction("set_paused", JSON.stringify({ paused: a.paused })) : null,
    "timeScale" in a ? toAction("set_time_scale", JSON.stringify({ scale: a.timeScale })) : null,
    a.resetEnergy === true ? toAction("reset_energy", "{}") : null,
    "spawnSpeedKmh" in a && a.spawnSpeedKmh !== null
      ? toAction("spawn_object", JSON.stringify({ speedKmh: a.spawnSpeedKmh }))
      : null,
  ];
  return out.filter((x): x is ChatAction => x !== null);
}

// Tekil komutu doğrular; geçersizse null döner
function toAction(name: string, rawArgs: string | undefined): ChatAction | null {
  let args: Record<string, unknown>;
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return null;
  }
  switch (name) {
    case "spawn_object": {
      const v = Number(args.speedKmh);
      if (!Number.isFinite(v)) return null;
      return { name, args: { speedKmh: Math.min(Math.max(Math.round(v * 10) / 10, MIN_SPEED), MAX_SPEED) } };
    }
    case "set_night":
      return typeof args.isNight === "boolean" ? { name, args: { isNight: args.isNight } } : null;
    case "set_paused":
      return typeof args.paused === "boolean" ? { name, args: { paused: args.paused } } : null;
    case "set_time_scale": {
      const v = Number(args.scale);
      return v === 1 || v === 5 || v === 10 ? { name, args: { scale: v } } : null;
    }
    case "reset_energy":
      return { name, args: {} };
    default:
      return null;
  }
}

// Model araç çağırıp metin yazmazsa kullanıcıya gösterilecek cümle
function describe(actions: ChatAction[]): string {
  const parts = actions.map((a) => {
    switch (a.name) {
      case "spawn_object":
        return `${a.args.speedKmh} km/s hızla bir ${a.args.speedKmh > 7 ? "araç" : "yaya"} gönderdim`;
      case "set_night":
        return a.args.isNight ? "geceye geçtim" : "gündüze geçtim";
      case "set_paused":
        return a.args.paused ? "simülasyonu duraklattım" : "simülasyonu devam ettirdim";
      case "set_time_scale":
        return `zaman çarpanını ${a.args.scale}x yaptım`;
      case "reset_energy":
        return "enerji sayaçlarını sıfırladım";
    }
  });
  const text = parts.join(", ");
  return text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1) + ".";
}

interface LlmToolCall {
  function?: { name?: string; arguments?: string };
}
interface LlmResponse {
  choices?: { message?: { content?: string | null; tool_calls?: LlmToolCall[] } }[];
}

// Panel Markdown göstermez: modelin yine de kullandığı kalın/italik ve başlık işaretlerini kaldırır
export function plainText(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/__(.+?)__/gs, "$1")
    .replace(/(^|\s)\*(\S(?:.*?\S)?)\*(?=\s|[.,!?;:]|$)/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

// Servisin hata cevabından kısa hata kodunu çıkarır (ör. "tool_use_failed", "invalid_api_key")
// ve ayrıntıyı sunucu kaydına yazar
async function errorCode(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  console.error("LLM hatası", res.status, text.slice(0, 1000));
  try {
    const e = (JSON.parse(text) as { error?: { code?: unknown; type?: unknown } }).error;
    const code = typeof e?.code === "string" ? e.code : typeof e?.type === "string" ? e.type : "";
    return code.replace(/[^\w.-]/g, "").slice(0, 60);
  } catch {
    return "";
  }
}

// ---------- Uç nokta ----------

export async function POST(request: Request): Promise<Response> {
  const providerName = (process.env.LLM_PROVIDER ?? "groq") as keyof typeof PROVIDERS;
  const provider = PROVIDERS[providerName];
  if (!provider) return error("Sunucu yapılandırması hatalı (LLM_PROVIDER).", 500);
  const apiKey = process.env[provider.keyEnv];
  if (!apiKey) return error("Sunucu yapılandırılmamış: API anahtarı yok.", 500);
  const configuredModel = process.env[provider.modelEnv] || provider.defaultModel;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "bilinmiyor";
  if (rateLimited(ip, Date.now()))
    return error("Çok sık istek gönderildi. Lütfen bir dakika sonra tekrar deneyin.", 429);

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return error("İstek çok büyük.", 413);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return error("İstek JSON değil.", 400);
  }
  const parsed = parseRequest(raw);
  if (typeof parsed === "string") return error(parsed, 400);

  const messages = [{ role: "system", content: systemPrompt(parsed.state) }, ...parsed.messages];
  const callLlm = (m: string, temperature: number) =>
    fetch(provider.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: m, temperature, max_tokens: 400, tools: TOOLS, tool_choice: "auto", messages }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

  let model = resolvedModel[providerName] ?? configuredModel;
  let llm: Response;
  let errCode = "";
  try {
    llm = await callLlm(model, 0.3);
    if (!llm.ok && llm.status !== 429) errCode = await errorCode(llm);

    // Model bu hesapta yoksa: hesabın model listesinden tercih sırasındaki ilk uygun modele geç
    if (errCode === "model_not_found" || llm.status === 404) {
      const available = await listModels(provider.url, apiKey);
      const next = [configuredModel, ...provider.fallbackModels].find((id) => id !== model && available.includes(id));
      if (!next) {
        const list = available.filter((id) => !/whisper|tts|guard/i.test(id)).slice(0, 8).join(", ");
        return error(`Model "${model}" bulunamadı ve uygun yedek yok. Kullanılabilir modeller: ${list || "liste alınamadı"}. GROQ_MODEL ile seçilebilir.`, 502);
      }
      model = next;
      resolvedModel[providerName] = next; // sonraki isteklerde doğrudan bu kullanılır
      llm = await callLlm(model, 0.3);
      errCode = llm.ok || llm.status === 429 ? "" : await errorCode(llm);
    }

    // Model araç çağrısını bozuk üretirse Groq 400 "tool_use_failed" döner: bir kez daha, kararlı ayarla dene
    if (errCode === "tool_use_failed") {
      llm = await callLlm(model, 0);
      errCode = llm.ok || llm.status === 429 ? "" : await errorCode(llm);
    }
  } catch {
    return error("Yapay zekâ servisine ulaşılamadı. Lütfen tekrar deneyin.", 502);
  }

  if (llm.status === 429)
    return error("Ücretsiz kullanım sınırına ulaşıldı. Lütfen biraz sonra tekrar deneyin.", 429);
  if (!llm.ok) {
    // Hata türü (anahtar ya da istem değil) kullanıcıya da gösterilir; teşhisi kolaylaştırır
    return error(`Yapay zekâ servisi hata verdi (HTTP ${llm.status}${errCode ? `, ${errCode}` : ""}). Lütfen tekrar deneyin.`, 502);
  }

  const data = (await llm.json()) as LlmResponse;
  const message = data.choices?.[0]?.message;
  const actions = (message?.tool_calls ?? []).flatMap((c) => toActions(c.function?.name ?? "", c.function?.arguments));
  const content = plainText(message?.content ?? "");
  const reply = content || (actions.length > 0 ? describe(actions) : "Bunu anlayamadım, başka şekilde sorar mısın?");

  const body: ChatResponse = { reply, actions, model };
  return json(body);
}

// Sunucu örneği boyunca, model bulunamadığında seçilen yedek model hatırlanır
const resolvedModel: Partial<Record<keyof typeof PROVIDERS, string>> = {};

// Testler için
export function _resetResolvedModel(): void {
  for (const k of Object.keys(resolvedModel)) delete resolvedModel[k as keyof typeof PROVIDERS];
}

// Hesabın erişebildiği model kimlikleri (OpenAI uyumlu GET /models)
async function listModels(chatUrl: string, apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(chatUrl.replace(/\/chat\/completions$/, "/models"), {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { id?: unknown }[] };
    return (data.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}
