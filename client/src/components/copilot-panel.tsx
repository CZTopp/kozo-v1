import { useState, useCallback, createContext, useContext, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, Square, Trash2, Loader2 } from "lucide-react";
import { useModel } from "@/lib/model-context";
import { useLocation } from "wouter";
import ReactMarkdown from "react-markdown";

interface CopilotContextProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const CopilotContext = createContext<CopilotContextProps | null>(null);

export function useCopilot() {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error("useCopilot must be used within CopilotProvider");
  return ctx;
}

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen(prev => !prev), []);
  return (
    <CopilotContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </CopilotContext.Provider>
  );
}

export function CopilotTrigger() {
  const { toggle } = useCopilot();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle copilot"
      data-testid="button-copilot-toggle"
    >
      <Sparkles className="h-4 w-4" />
    </Button>
  );
}

type CopilotMode = "financial" | "crypto-project" | "crypto-dashboard";

function useCopilotMode(): { mode: CopilotMode; cryptoProjectId: string | null; label: string } {
  const [location] = useLocation();

  const cryptoProjectMatch = location.match(/\/crypto\/(?:tokenomics|financials|valuation|revenue|token-flows)\/([^/]+)/);
  if (cryptoProjectMatch) {
    return { mode: "crypto-project", cryptoProjectId: cryptoProjectMatch[1], label: "Crypto Project" };
  }

  if (location === "/crypto" || location.startsWith("/crypto")) {
    return { mode: "crypto-dashboard", cryptoProjectId: null, label: "Crypto Watchlist" };
  }

  return { mode: "financial", cryptoProjectId: null, label: "Financial Model" };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const STARTER_PROMPTS: Record<CopilotMode, { label: string; prompt: string }[]> = {
  "financial": [
    { label: "DCF Analysis", prompt: "What's driving DCF upside or downside?" },
    { label: "Model Summary", prompt: "Summarize this financial model" },
    { label: "Red Flags", prompt: "Are there any red flags in the data?" },
  ],
  "crypto-project": [
    { label: "Token Supply", prompt: "Analyze the token supply and unlock schedule" },
    { label: "Token Risks", prompt: "What are the biggest risks for this token?" },
    { label: "Revenue", prompt: "How sustainable is the protocol's revenue?" },
  ],
  "crypto-dashboard": [
    { label: "Best Fundamentals", prompt: "Which tracked projects have the best fundamentals?" },
    { label: "Compare Tokens", prompt: "Compare the tokens in my watchlist" },
    { label: "Valuation Metrics", prompt: "What metrics matter most for token valuation?" },
  ],
};

function ChatInner({ mode, cryptoProjectId, modelId }: { mode: CopilotMode; cryptoProjectId: string | null; modelId: string | undefined }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const prompts = STARTER_PROMPTS[mode];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    const history = messages.map(m => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body: Record<string, any> = {
        message: text.trim(),
        history,
      };

      if (cryptoProjectId) {
        body.cryptoProjectId = cryptoProjectId;
      } else if (mode === "crypto-dashboard") {
        body.context = "crypto-dashboard";
      } else if (modelId) {
        body.modelId = modelId;
      } else {
        body.context = "general";
      }

      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Request failed" }));
        throw new Error(err.message || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let assistantContent = "";
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const data = JSON.parse(payload);
            if (data.error) {
              assistantContent += `\n\n_Error: ${data.error}_`;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
              continue;
            }
            if (data.content) {
              assistantContent += data.content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          } catch {}
        }
      }

      if (!assistantContent) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "_No response generated._" };
          return updated;
        });
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: `_Error: ${err.message}_` };
          return updated;
        }
        return [...prev, { role: "assistant", content: `_Error: ${err.message}_` }];
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages, isStreaming, mode, cryptoProjectId, modelId]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearChat = useCallback(() => {
    if (isStreaming) {
      abortRef.current?.abort();
      setIsStreaming(false);
    }
    setMessages([]);
  }, [isStreaming]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }, [input, sendMessage]);

  const greeting = mode === "crypto-project"
    ? "Ask about this crypto project's tokenomics, valuation, or fundamentals."
    : mode === "crypto-dashboard"
    ? "Ask about your tracked crypto projects or general crypto topics."
    : "Ask about your financial model, valuation, or key metrics.";

  return (
    <div className="flex-1 flex flex-col min-h-0" data-testid="chatkit-container">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-2">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground max-w-[240px]" data-testid="text-copilot-greeting">
              {greeting}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[260px]">
              {prompts.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  className="justify-start text-left text-xs h-auto py-2 px-3"
                  onClick={() => sendMessage(p.prompt)}
                  disabled={isStreaming}
                  data-testid={`button-starter-${p.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              data-testid={`message-${msg.role}-${i}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-1">
                    <ReactMarkdown>{msg.content || (isStreaming && i === messages.length - 1 ? "..." : "")}</ReactMarkdown>
                  </div>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
            </div>
          ))
        )}
        {isStreaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-2">
        <div className="flex items-end gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              className="shrink-0"
              data-testid="button-clear-chat"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              rows={1}
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[36px] max-h-[120px]"
              disabled={isStreaming}
              data-testid="input-copilot-message"
            />
          </div>
          {isStreaming ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={stopStreaming}
              className="shrink-0"
              data-testid="button-stop-streaming"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="shrink-0"
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CopilotPanel() {
  const { selectedModel: model } = useModel();
  const { open } = useCopilot();
  const { mode, cryptoProjectId } = useCopilotMode();

  const contextLabel = mode === "crypto-project"
    ? "Crypto"
    : mode === "crypto-dashboard"
    ? "Watchlist"
    : model?.ticker || model?.name || "Model";

  return (
    <div
      data-testid="copilot-panel"
      data-state={open ? "open" : "closed"}
      className={`bg-sidebar text-sidebar-foreground h-full flex-col overflow-hidden transition-[width] duration-200 ease-in-out ${
        open ? "w-[var(--copilot-width)] border-l flex" : "w-0"
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap p-3 border-b min-h-[calc(theme(spacing.2)*2+theme(spacing.9))]">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-semibold text-sm truncate">Copilot</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-xs max-w-[120px] truncate" data-testid="badge-copilot-context">
            {contextLabel}
          </Badge>
        </div>
      </div>

      {open && (
        <ChatInner
          key={`${mode}-${cryptoProjectId || model?.id || "general"}`}
          mode={mode}
          cryptoProjectId={cryptoProjectId}
          modelId={model?.id}
        />
      )}
    </div>
  );
}
