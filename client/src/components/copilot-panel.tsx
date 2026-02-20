import { useState, useCallback, createContext, useContext, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertCircle } from "lucide-react";
import { useModel } from "@/lib/model-context";
import { useLocation } from "wouter";
import { ChatKit, useChatKit } from "@openai/chatkit-react";

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

function ChatKitInner({ mode, cryptoProjectId, modelId }: { mode: CopilotMode; cryptoProjectId: string | null; modelId: string | undefined }) {
  const prompts = STARTER_PROMPTS[mode];
  const [initError, setInitError] = useState<string | null>(null);

  const contextHeader = useMemo(() => {
    const ctx: Record<string, any> = { mode };
    if (cryptoProjectId) ctx.cryptoProjectId = cryptoProjectId;
    if (modelId) ctx.modelId = modelId;
    return JSON.stringify(ctx);
  }, [mode, cryptoProjectId, modelId]);

  const domainKey = (typeof window !== "undefined" && (window as any).__CHATKIT_DOMAIN_KEY__) || "kozo-self-hosted";

  const { control } = useChatKit({
    api: {
      url: "/api/chatkit",
      domainKey,
      async fetch(url, init) {
        const headers = new Headers(init?.headers);
        headers.set("X-ChatKit-Context", contextHeader);
        try {
          return await window.fetch(url, { ...init, headers, credentials: "same-origin" });
        } catch (err: any) {
          setInitError(err.message || "Connection failed");
          throw err;
        }
      },
    },
    theme: "dark",
    startScreen: {
      greeting: mode === "crypto-project"
        ? "Ask about this crypto project's tokenomics, valuation, or fundamentals."
        : mode === "crypto-dashboard"
        ? "Ask about your tracked crypto projects or general crypto topics."
        : "Ask about your financial model, valuation, or key metrics.",
      prompts,
    },
    header: { enabled: false },
  });

  if (initError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-3 text-sm" data-testid="chatkit-error">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-center text-muted-foreground">{initError}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setInitError(null);
            window.location.reload();
          }}
          data-testid="button-chatkit-retry"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0" data-testid="chatkit-container">
      <ChatKit control={control} className="h-full w-full" />
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
        <ChatKitInner
          key={`${mode}-${cryptoProjectId || model?.id || "general"}`}
          mode={mode}
          cryptoProjectId={cryptoProjectId}
          modelId={model?.id}
        />
      )}
    </div>
  );
}
