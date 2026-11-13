import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, RotateCcw, Send, Square } from 'lucide-react';
import type { BoilerUnit, PlantDashboardState } from '../types/boiler';
import type { Language } from '../i18n/translations';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface AiAssistantViewProps {
  dashboard: PlantDashboardState | null;
  selectedBoiler: BoilerUnit;
  language: Language;
  initialPrompt?: string | null;
  onConsumeInitialPrompt?: () => void;
}

const SUGGESTED_PROMPTS: Array<{ title: string; subtitle: string; prompt: string }> = [
  {
    title: '7-Day Fuel & Cost Forecast',
    subtitle: 'Predict fuel burn, BDT spend & steam margin',
    prompt:
      'Based on current live firing rates, predict our next 24-hour and 7-day fuel consumption, estimated BDT cost, and efficiency outlook across BLR-01, BLR-02, and BLR-03.',
  },
  {
    title: 'Textile Dyeing & Stenter Capacity',
    subtitle: 'HT jet dyeing & heat-setting steam demand',
    prompt:
      'Can our active boilers safely support 4 HT polyester jet dyeing machines (130 °C) and 2 stenter heat-setting frames simultaneously? Recommend optimal header pressure and whether BLR-03 should leave standby.',
  },
  {
    title: 'Maintenance & Failure Risk',
    subtitle: 'Predict service deadline & valve/scale risk',
    prompt:
      'Analyze BLR-02 maintenance urgency (hours since last service), predict when it reaches critical threshold at 18h/day shift load, and list textile-specific inspection priorities.',
  },
  {
    title: 'Steam Quality & Condensate ROI',
    subtitle: 'Dye shade uniformity & fuel recovery math',
    prompt:
      'Explain how boiler TDS carryover and condensate return temperature affect cotton reactive dyeing shade consistency and calculate fuel savings if we raise condensate return by 15%.',
  },
  {
    title: 'Executive Summary (বাংলা)',
    subtitle: 'আজকের অবস্থা ও আগামী ২৪ ঘণ্টার পূর্বাভাস',
    prompt:
      'আমাদের কোম্পানির সব বয়লারের বর্তমান অবস্থা, আজকের জ্বালানি খরচ, রক্ষণাবেক্ষণ ঝুঁকি এবং আগামী ২৪ ঘণ্টার পূর্বাভাস বাংলায় ম্যানেজমেন্টের জন্য সংক্ষেপে বিশ্লেষণ করো।',
  },
];

function renderFormattedText(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const renderInline = (line: string): React.ReactNode => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-slate-900 dark:text-slate-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="px-1 py-0.5 text-[12px] font-mono bg-slate-100 dark:bg-slate-800 rounded text-slate-800 dark:text-slate-200"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const flushList = (keyBase: number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${keyBase}`} className="list-disc pl-5 space-y-1 my-2 text-sm leading-relaxed">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushList(idx);
      return;
    }

    if (/^#{1,3}\s+/.test(line)) {
      flushList(idx);
      const heading = line.replace(/^#{1,3}\s+/, '');
      elements.push(
        <h4
          key={`h-${idx}`}
          className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-3 mb-1"
        >
          {renderInline(heading)}
        </h4>
      );
      return;
    }

    if (/^[-*•]\s+/.test(line.trim())) {
      listItems.push(line.trim().replace(/^[-*•]\s+/, ''));
      return;
    }

    if (/^\d+\.\s+/.test(line.trim())) {
      listItems.push(line.trim().replace(/^\d+\.\s+/, ''));
      return;
    }

    flushList(idx);
    elements.push(
      <p key={`p-${idx}`} className="text-sm leading-relaxed my-1.5">
        {renderInline(line)}
      </p>
    );
  });

  flushList(lines.length);
  return elements;
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  dashboard,
  selectedBoiler,
  language,
  initialPrompt,
  onConsumeInitialPrompt,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      text:
        language === 'bn'
          ? `স্বাগতম! আমি **ThermoGrid Plant AI** — আপনার কোম্পানির বয়লার অপারেশন, টেক্সটাইল ডাইং/ফিনিশিং স্টিম ইঞ্জিনিয়ারিং এবং ভবিষ্যৎ পূর্বাভাস সহায়ক।\n\nআমি এখন **${selectedBoiler.id} (${selectedBoiler.name})** সহ প্ল্যান্টের সব বয়লারের লাইভ ডাটা দেখতে পাচ্ছি। নিচের যেকোনো প্রশ্ন করুন বা বাম পাশের প্রম্পট বেছে নিন।`
          : `Welcome to **ThermoGrid Plant AI** — your textile utility & boiler intelligence assistant.\n\nI have live access to your company's boiler fleet (**BLR-01**, **BLR-02**, **BLR-03**), active alarms, maintenance schedules, and specialized **textile wet-processing & finishing** engineering benchmarks. Ask me about current plant status, textile steam optimization, or **future fuel & maintenance predictions**.`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const sendMessage = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || streaming) return;

    setErrorMsg(null);
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    const assistantId = `ast-${Date.now() + 1}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      text: '',
      timestamp: new Date().toISOString(),
    };

    const conversationForApi = [...messages, userMsg]
      .filter((m) => m.id !== 'welcome-1')
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: conversationForApi,
          selectedBoilerId: selectedBoiler.id,
          language,
        }),
      });

      if (!response.ok || !response.body) {
        const errData = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const evt of events) {
          const line = evt
            .split('\n')
            .find((l) => l.startsWith('data: '));
          if (!line) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          const payload = JSON.parse(jsonStr) as {
            delta?: string;
            done?: boolean;
            error?: string;
          };

          if (payload.error) {
            throw new Error(payload.error);
          }
          if (payload.delta) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, text: m.text + payload.delta } : m
              )
            );
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to reach AI assistant.';
      setErrorMsg(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.text
            ? { ...m, text: `Unable to complete response: ${msg}` }
            : m
        )
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  useEffect(() => {
    if (initialPrompt && !streaming) {
      sendMessage(initialPrompt);
      onConsumeInitialPrompt?.();
    }
  }, [initialPrompt]);

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setErrorMsg(null);
    setMessages((prev) => prev.slice(0, 1));
  };

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const runningBoilers = (dashboard?.boilers ?? []).filter((b) => b.isRunning);
  const totalSteam = runningBoilers.reduce((s, b) => s + b.steamOutputKgHr, 0);
  const totalFuelLph = runningBoilers.reduce((s, b) => s + b.fuelConsumptionLph, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Context & Prompts Rail (4 cols) */}
      <aside className="lg:col-span-4 space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Live Plant Context Feed
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Grounded in real-time telemetry & textile benchmarks
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>New Chat</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Active Steam</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                {totalSteam.toLocaleString()} kg/hr
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">24h Fuel Forecast</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                ~{(totalFuelLph * 24).toFixed(0)} L
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Focus Boiler</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {selectedBoiler.id} · {selectedBoiler.temperatureC.toFixed(1)} °C
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Active Alarms</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                {(dashboard?.alerts ?? []).filter((a) => !a.resolved).length} open
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Textile & Prediction Prompts
          </h3>
          <div className="space-y-2">
            {SUGGESTED_PROMPTS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                disabled={streaming}
                onClick={() => sendMessage(item.prompt)}
                className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {item.title}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {item.subtitle}
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main ChatGPT-Style Conversation Stage (8 cols) */}
      <section className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col h-[680px]">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              ThermoGrid Plant & Textile AI
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Company boiler telemetry, textile wet-processing guidance & predictive forecasting
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {streaming ? 'Generating...' : 'Ready'}
          </span>
        </div>

        {/* Scrollable Message Thread */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {isUser ? 'Plant Management' : 'ThermoGrid Plant AI'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div
                  className={`max-w-[90%] rounded-xl px-4 py-3 ${
                    isUser
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm'
                      : 'bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {isUser ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  ) : msg.text ? (
                    <div>{renderFormattedText(msg.text)}</div>
                  ) : (
                    <p className="text-xs font-mono text-slate-400">Analyzing live plant telemetry...</p>
                  )}
                </div>

                {!isUser && msg.text && !streaming && (
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy response</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
          <div ref={scrollEndRef} />
        </div>

        {errorMsg && (
          <div className="mx-6 mb-2 px-3 py-2 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-end gap-3"
        >
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder={
              language === 'bn'
                ? 'কোম্পানির বয়লার, টেক্সটাইল ডাইং/স্টেন্টার বা ভবিষ্যৎ পূর্বাভাস সম্পর্কে জিজ্ঞাসা করুন...'
                : 'Ask about boiler status, textile dyeing/stenter steam targets, or future predictions...'
            }
            className="flex-1 resize-none px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-600/40"
          />
          {streaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-white transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          )}
        </form>
      </section>
    </div>
  );
};
