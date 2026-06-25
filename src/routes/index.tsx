import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Phone, Video, Send, ShieldCheck, X } from "lucide-react";
import elizabethImg from "@/assets/elizabeth.jpeg";
import chatBgImg from "@/assets/chat-bg.jpeg";

const jessicaAsset = { url: elizabethImg };
const chatBgAsset = { url: chatBgImg };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elizabeth Jasmine ✓ — Verified Seller Elite" },
      { name: "description", content: "Soporte premium, ventas autorizadas y atención 24/7 con Elizabeth Jasmine." },
    ],
  }),
  component: ChatPage,
});

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  buy?: { producto: string; plan: string; metodo: string } | null;
  time: string;
};

const STORAGE_KEY = "jh_chat_v1";
const BLOCK_KEY = "jh_block_until";
const COUNT_KEY = "jh_msg_count";
const MAX_MESSAGES = 50;
const WHATSAPP = "+50492404962";

const now = () =>
  new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
const uid = () => Math.random().toString(36).slice(2, 10);

function parseBuy(text: string) {
  const m = text.match(/\[\[BUY:([^\]]+)\]\]/);
  if (!m) return { clean: text, buy: null as Msg["buy"] };
  const parts = Object.fromEntries(
    m[1].split("|").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  ) as Record<string, string>;
  return {
    clean: text.replace(m[0], "").trim(),
    buy: {
      producto: parts.producto ?? "",
      plan: parts.plan ?? "",
      metodo: parts.metodo ?? "",
    },
  };
}

function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {}
  }, []);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showVerified, setShowVerified] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<number>(0);
  const [msgCount, setMsgCount] = useState<number>(0);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(BLOCK_KEY) || 0);
      if (v) setBlockedUntil(v);
      const c = Number(localStorage.getItem(COUNT_KEY) || 0);
      if (c) setMsgCount(c);
    } catch {}
  }, []);
  const [, force] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing]);

  // Tick to update blocked countdown
  useEffect(() => {
    if (!blockedUntil) return;
    const i = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, [blockedUntil]);

  const isBlocked = blockedUntil > Date.now();
  const blockRemaining = useMemo(() => {
    if (!isBlocked) return "";
    const ms = blockedUntil - Date.now();
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return `${h}h ${m}m ${s}s`;
  }, [isBlocked, blockedUntil]);

  const limitReached = msgCount >= MAX_MESSAGES;

  async function send() {
    const text = input.trim();
    if (!text || typing || isBlocked || limitReached) return;
    const userMsg: Msg = { id: uid(), role: "user", content: text, time: now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    const newCount = msgCount + 1;
    setMsgCount(newCount);
    try { localStorage.setItem(COUNT_KEY, String(newCount)); } catch {}

    // Primera vez: espera 7-10s antes de los puntos. Luego 5s escribiendo.
    const isFirst = messages.length === 0;
    const preDelay = isFirst ? 7000 + Math.random() * 3000 : 1200 + Math.random() * 2500;
    await new Promise((r) => setTimeout(r, preDelay));
    setTyping(true);
    const typeDelay = isFirst ? 5000 : 3500 + Math.random() * 3000;
    await new Promise((r) => setTimeout(r, typeDelay));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as { reply?: string };
      const reply = (data.reply || "").trim();

      if (!reply) {
        // silencio absoluto si hay problema
        setTyping(false);
        return;
      }

      if (reply.includes("[[BLOCK]]")) {
        const until = Date.now() + 24 * 60 * 60 * 1000;
        localStorage.setItem(BLOCK_KEY, String(until));
        setBlockedUntil(until);
      } else {
        const { clean, buy } = parseBuy(reply);
        if (clean) {
          setMessages((m) => [
            ...m,
            { id: uid(), role: "assistant", content: clean, buy, time: now() },
          ]);
        }
      }
    } catch {
      // silencio absoluto
    } finally {
      setTyping(false);
    }
  }

  function handleBuy(buy: NonNullable<Msg["buy"]>) {
    const msg =
      `Hola Elizabeth, quiero comprar un panel.\n` +
      `Método: ${buy.metodo}\n` +
      `Producto: ${buy.producto}\n` +
      `Plan: ${buy.plan}`;
    const url = `https://wa.me/${WHATSAPP.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  return (
    <main className="relative flex h-[100dvh] w-full flex-col overflow-hidden">
      {/* Fixed background — never scrolls */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          backgroundImage: `url(${chatBgAsset.url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 bg-black/20" />
      {/* Header */}
      <header className="glass-strong z-20 flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <button className="p-1 -ml-1 opacity-80 active:opacity-50" aria-label="Atrás">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          onClick={() => setShowProfile(true)}
          className="flex flex-1 items-center gap-3 text-left active:opacity-70"
        >
          <div className="avatar-ring h-10 w-10 overflow-hidden rounded-full">
            <img src={jessicaAsset.url} alt="Elizabeth" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-semibold tracking-tight">
                Elizabeth Jasmine
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVerified(true);
                }}
                className="verified-shield flex h-4 w-4 items-center justify-center rounded-[5px]"
                aria-label="Verificado"
              >
                <ShieldCheck className="h-2.5 w-2.5 text-white" strokeWidth={3} />
              </button>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {typing ? "escribiendo…" : "en línea"}
            </div>
          </div>
        </button>
        <button className="p-2 opacity-80 active:opacity-50" aria-label="Llamar">
          <Phone className="h-5 w-5" />
        </button>
        <button className="p-2 opacity-80 active:opacity-50" aria-label="Video">
          <Video className="h-5 w-5" />
        </button>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto overscroll-contain scroll-smooth px-3 py-3"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-1.5">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const grouped = prev?.role === m.role;
            return (
              <div
                key={m.id}
                className={`msg-in flex ${m.role === "user" ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}
              >
                <div className="flex max-w-[82%] flex-col gap-1.5">
                  <div
                    className={[
                      "whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] leading-snug",
                      m.role === "user"
                        ? "bubble-me rounded-2xl rounded-br-md"
                        : "bubble-them rounded-2xl rounded-bl-md",
                    ].join(" ")}
                  >
                    {m.content || " "}
                    <span className="ml-2 inline-block translate-y-[1px] text-[10px] opacity-60">
                      {m.time}
                    </span>
                  </div>
                  {m.buy && (
                    <button
                      onClick={() => handleBuy(m.buy!)}
                      className="buy-btn self-start rounded-2xl px-5 py-2.5 text-sm font-semibold text-white active:scale-[0.97] transition-transform"
                    >
                      🛒 COMPRAR
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {typing && (
            <div className="msg-in mt-2 flex justify-start">
              <div className="bubble-them flex items-center gap-1 rounded-2xl rounded-bl-md px-4 py-3">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Composer */}
      <footer
        className="glass-strong z-20 px-3 pt-2"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
      >
        {isBlocked ? (
          <div className="mx-auto max-w-2xl rounded-2xl bg-destructive/15 px-4 py-3 text-center text-sm text-destructive">
            Chat bloqueado por hacer perder el tiempo. Tiempo restante: {blockRemaining}
          </div>
        ) : limitReached ? (
          <div className="mx-auto max-w-2xl rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-center text-sm text-muted-foreground">
            Llegaste al límite de {MAX_MESSAGES} mensajes. Para continuar, escríbeme por WhatsApp.
          </div>
        ) : (
          <>
            <div className="mx-auto mb-1.5 flex max-w-2xl justify-end px-1">
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums tracking-wide transition-colors",
                  MAX_MESSAGES - msgCount <= 5
                    ? "bg-destructive/15 text-destructive/90"
                    : MAX_MESSAGES - msgCount <= 15
                      ? "bg-white/10 text-foreground/70"
                      : "bg-white/5 text-muted-foreground/70",
                ].join(" ")}
                aria-label="Mensajes restantes"
                title="Mensajes restantes"
              >
                {MAX_MESSAGES - msgCount}/{MAX_MESSAGES}
              </span>
            </div>
            <div className="mx-auto flex max-w-2xl items-end gap-2.5">
              <div className="glass flex flex-1 items-end rounded-[26px] px-5 py-2.5 shadow-lg">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="Mensaje"
                  className="max-h-32 w-full resize-none bg-transparent text-[16px] leading-snug text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
                  style={{ height: "auto" }}
                />
              </div>
              <button
                onClick={send}
                disabled={!input.trim() || typing}
                className="group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full disabled:opacity-40 active:scale-90 transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, oklch(0.78 0.18 250) 0%, oklch(0.6 0.22 270) 50%, oklch(0.55 0.24 290) 100%)",
                  boxShadow: "0 8px 24px oklch(0.55 0.22 270 / 50%), inset 0 1px 0 oklch(1 0 0 / 25%), inset 0 -2px 4px oklch(0 0 0 / 20%)",
                }}
                aria-label="Enviar"
              >
                <Send className="h-5 w-5 translate-x-[1px] -translate-y-[1px] text-white drop-shadow-sm" strokeWidth={2.5} fill="white" />
              </button>
            </div>
          </>
        )}
      </footer>

      {/* Profile sheet */}
      {showProfile && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowProfile(false)}
        >
          <div
            className="sheet-in glass-strong w-full max-w-md rounded-t-3xl px-6 pb-8 pt-6"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex flex-col items-center text-center">
              <div className="avatar-ring h-24 w-24 overflow-hidden rounded-full">
                <img src={jessicaAsset.url} alt="Elizabeth" className="h-full w-full object-cover" />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">Elizabeth Jasmine</h2>
                <div className="verified-shield flex h-5 w-5 items-center justify-center rounded-[6px]">
                  <ShieldCheck className="h-3 w-3 text-white" strokeWidth={3} />
                </div>
              </div>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-primary">
                Verified Seller Elite
              </p>
              <div className="mt-5 w-full space-y-2 text-left text-sm">
                {[
                  "Authorized Seller",
                  "Premium Customer Support",
                  "Global Sales Representative",
                  "Fast Response System",
                  "Trusted Commercial Account",
                  "Member Since 2022",
                ].map((t) => (
                  <div key={t} className="glass rounded-xl px-4 py-2.5">{t}</div>
                ))}
                <div className="glass rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <span>Status</span>
                  <span className="flex items-center gap-1.5 text-[hsl(140,80%,65%)]">
                    <span className="h-2 w-2 rounded-full bg-current" /> Online
                  </span>
                </div>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Disponible para consultas, soporte y compras.
              </p>
            </div>
            <button
              onClick={() => setShowProfile(false)}
              className="absolute right-4 top-4 rounded-full p-2 opacity-70 active:opacity-40"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Verified popup */}
      {showVerified && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-6"
          onClick={() => setShowVerified(false)}
        >
          <div
            className="sheet-in glass-strong w-full max-w-sm rounded-3xl p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="verified-shield mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
              <ShieldCheck className="h-7 w-7 text-white" strokeWidth={2.5} />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Verified Seller Elite</h3>
            <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <p>Identity Confirmed</p>
              <p>Trusted By Thousands</p>
              <p>Premium Support Access</p>
            </div>
            <button
              onClick={() => setShowVerified(false)}
              className="mt-5 w-full rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] transition-transform"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
