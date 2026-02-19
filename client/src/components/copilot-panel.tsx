import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Trash2, Loader2 } from "lucide-react";
import { useModel } from "@/lib/model-context";
import { useLocation } from "wouter";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

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

const FINANCIAL_PROMPTS = [
  "What's driving DCF upside or downside?",
  "Summarize this financial model",
  "Are there any red flags in the data?",
  "Suggest WACC parameter adjustments",
  "Explain the key financial ratios",
  "What's the revenue growth trajectory?",
];

const CRYPTO_PROJECT_PROMPTS = [
  "Analyze the token supply and unlock schedule",
  "What are the biggest risks for this token?",
  "How sustainable is the protocol's revenue?",
  "Evaluate the token allocation fairness",
  "What does the fully diluted valuation imply?",
  "Compare emission costs vs protocol revenue",
];

const CRYPTO_DASHBOARD_PROMPTS = [
  "Which tracked projects have the best fundamentals?",
  "Compare the tokens in my watchlist",
  "What are common red flags in crypto investing?",
  "Explain token vesting and unlock dynamics",
  "How to evaluate DeFi protocol revenue",
  "What metrics matter most for token valuation?",
];

export function CopilotPanel() {
  const { selectedModel: model } = useModel();
  const { open } = useCopilot();
  const { mode, cryptoProjectId, label } = useCopilotMode();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prevModeRef = useRef<string>("");

  useEffect(() => {
    const currentKey = `${mode}-${cryptoProjectId || model?.id || ""}`;
    if (prevModeRef.current && prevModeRef.current !== currentKey) {
      setMessages([]);
    }
    prevModeRef.current = currentKey;
  }, [mode, cryptoProjectId, model?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const suggestedPrompts = mode === "crypto-project"
    ? CRYPTO_PROJECT_PROMPTS
    : mode === "crypto-dashboard"
    ? CRYPTO_DASHBOARD_PROMPTS
    : FINANCIAL_PROMPTS;

  const canSend = mode === "crypto-dashboard" || mode === "crypto-project" || !!model;

  const contextLabel = mode === "crypto-project"
    ? "Crypto"
    : mode === "crypto-dashboard"
    ? "Watchlist"
    : model?.ticker || model?.name || "Model";

  const placeholderText = mode === "crypto-dashboard"
    ? "Ask about crypto..."
    : mode === "crypto-project"
    ? "Ask about this project..."
    : model
    ? "Ask Copilot..."
    : "Select a company";

  const emptyStateText = mode === "crypto-dashboard"
    ? "Ask about your tracked crypto projects or general crypto topics."
    : mode === "crypto-project"
    ? "Ask about this crypto project's tokenomics, valuation, or fundamentals."
    : `Ask about ${model?.name || "your financial model"}.`;

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming || !canSend) return;

    const userMessage: Message = { role: "user", content: text.trim() };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInput("");
    setIsStreaming(true);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages(prev => [...prev, assistantMessage]);

    const controller = new AbortController();
    abortRef.current = controller;

    const body: Record<string, any> = {
      message: text.trim(),
      history: updatedHistory.slice(-10),
    };

    if (mode === "crypto-project" && cryptoProjectId) {
      body.cryptoProjectId = cryptoProjectId;
    } else if (mode === "crypto-dashboard") {
      body.context = "crypto-dashboard";
    } else if (model) {
      body.modelId = model.id;
    }

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `Error: ${err.message || "Something went wrong"}`,
          };
          return updated;
        });
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullContent += parsed.content;
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: fullContent,
                    };
                    return updated;
                  });
                }
                if (parsed.error) {
                  fullContent += `\n\nError: ${parsed.error}`;
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: fullContent,
                    };
                    return updated;
                  });
                }
              } catch {}
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Error: ${err.message || "Failed to connect to Copilot"}`,
        };
        return updated;
      });
    }

    abortRef.current = null;
    setIsStreaming(false);
  }, [model, messages, isStreaming, mode, cryptoProjectId, canSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

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
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              data-testid="button-copilot-clear"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-3" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {emptyStateText}
              </p>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Suggestions
                </p>
                <div className="flex flex-col gap-1.5">
                  {suggestedPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(prompt)}
                      disabled={isStreaming || !canSend}
                      className="text-left text-xs p-2 rounded-md border hover-elevate transition-colors"
                      data-testid={`button-copilot-prompt-${i}`}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-lg p-2.5 text-xs ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                    data-testid={`text-copilot-message-${i}`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-xs dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-xs [&_p]:text-xs [&_li]:text-xs [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs [&_h4]:text-xs [&_table]:text-xs">
                        <ReactMarkdown>{msg.content || (isStreaming && i === messages.length - 1 ? "Thinking..." : "")}</ReactMarkdown>
                      </div>
                    ) : (
                      <span>{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-2">
          <div className="flex gap-1.5">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholderText}
              disabled={!canSend || isStreaming}
              rows={1}
              className="flex-1 resize-none rounded-md border bg-background px-2.5 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              data-testid="input-copilot-message"
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || !canSend || isStreaming}
              data-testid="button-copilot-send"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
