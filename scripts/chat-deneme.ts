// /api/chat fonksiyonunu sahte bir LLM servisine karşı dener (gerçek anahtar ve ağ kullanılmaz).
// Çalıştırma: npm run -s chat-deneme
import assert from "node:assert/strict";
import { POST, _resetRateLimit, type ChatResponse } from "../api/chat.ts";

process.env.GROQ_API_KEY = "sahte-anahtar";
delete process.env.LLM_PROVIDER;

const state = {
  source: "mock",
  isNight: true,
  object: null,
  lamps: [0, 0, 0, 0, 0],
  powerW: 0,
  normalPowerW: 500,
  smartWh: 1.2,
  normalWh: 4.8,
  simTimeSec: 34.5,
  timeScale: 5,
  paused: false,
};

let lastLlmBody: Record<string, unknown> | null = null;
let llmReply: unknown = null;
let llmStatus = 200;

globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
  lastLlmBody = JSON.parse(String(init?.body));
  return new Response(JSON.stringify(llmReply), { status: llmStatus });
}) as typeof fetch;

function request(body: unknown, ip = "1.1.1.1"): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const ask = (content: string) => ({ messages: [{ role: "user", content }], state });

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  _resetRateLimit();
  llmStatus = 200;
  await fn();
  passed++;
  console.log("✓", name);
}

await test("İki araç çağrısı: gece + 70 km/s araç", async () => {
  llmReply = {
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            { function: { name: "set_night", arguments: '{"isNight":true}' } },
            { function: { name: "spawn_object", arguments: '{"speedKmh":70}' } },
          ],
        },
      },
    ],
  };
  const res = await POST(request(ask("Gece yap ve 70 km/s hızla bir araç gönder")));
  assert.equal(res.status, 200);
  const body = (await res.json()) as ChatResponse;
  assert.deepEqual(body.actions, [
    { name: "set_night", args: { isNight: true } },
    { name: "spawn_object", args: { speedKmh: 70 } },
  ]);
  assert.equal(body.reply, "Geceye geçtim, 70 km/s hızla bir araç gönderdim.");
  // LLM'e araçlar, model ve güncel durum gitti mi?
  const sent = lastLlmBody as unknown as { model: string; tools: unknown[]; messages: { role: string; content: string }[] };
  assert.equal(sent.model, "llama-3.3-70b-versatile");
  assert.equal(sent.tools.length, 5);
  assert.equal(sent.messages[0].role, "system");
  assert.match(sent.messages[0].content, /"tasarrufYuzde":75/);
});

await test("Metin cevabı olduğu gibi döner", async () => {
  llmReply = { choices: [{ message: { content: "Şu ana kadar 3,6 Wh tasarruf ettik (%75)." } }] };
  const body = (await (await POST(request(ask("Ne kadar tasarruf ettik?")))).json()) as ChatResponse;
  assert.equal(body.reply, "Şu ana kadar 3,6 Wh tasarruf ettik (%75).");
  assert.deepEqual(body.actions, []);
});

await test("Geçersiz araç argümanları atılır, hız sınırlanır", async () => {
  llmReply = {
    choices: [
      {
        message: {
          tool_calls: [
            { function: { name: "set_time_scale", arguments: '{"scale":3}' } },
            { function: { name: "rm_rf", arguments: "{}" } },
            { function: { name: "spawn_object", arguments: '{"speedKmh":999}' } },
            { function: { name: "set_night", arguments: "bozuk json" } },
          ],
        },
      },
    ],
  };
  const body = (await (await POST(request(ask("karışık")))).json()) as ChatResponse;
  assert.deepEqual(body.actions, [{ name: "spawn_object", args: { speedKmh: 150 } }]);
});

await test("Geçersiz istekler 400", async () => {
  assert.equal((await POST(request("{bozuk"))).status, 400);
  assert.equal((await POST(request({ messages: [], state }))).status, 400);
  assert.equal((await POST(request({ messages: [{ role: "system", content: "x" }], state }))).status, 400);
  assert.equal((await POST(request(ask("x".repeat(501))))).status, 400);
  assert.equal((await POST(request({ messages: [{ role: "user", content: "selam" }] }))).status, 400);
});

await test("IP başına dakikada 10 istek sınırı", async () => {
  llmReply = { choices: [{ message: { content: "tamam" } }] };
  for (let i = 0; i < 10; i++) assert.equal((await POST(request(ask("selam"), "2.2.2.2"))).status, 200);
  assert.equal((await POST(request(ask("selam"), "2.2.2.2"))).status, 429);
  assert.equal((await POST(request(ask("selam"), "3.3.3.3"))).status, 200);
});

await test("Servis 429 verirse anlaşılır hata", async () => {
  llmStatus = 429;
  llmReply = { error: "rate limit" };
  const res = await POST(request(ask("selam")));
  assert.equal(res.status, 429);
  assert.match(((await res.json()) as { error: string }).error, /Ücretsiz kullanım sınırı/);
});

await test("Anahtar yoksa 500", async () => {
  const saved = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  assert.equal((await POST(request(ask("selam")))).status, 500);
  process.env.GROQ_API_KEY = saved;
});

console.log(`\n${passed} deneme geçti.`);
