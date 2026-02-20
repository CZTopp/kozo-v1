import { useState, useCallback, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
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

function ChatKitInner({ mode, cryptoProjectId, modelId }: { mode: CopilotMode; cryptoProjectId: string | null; modelId: string | undefined }) {
  const { control } = useChatKit({
    api: {
      async getClientSecret(existing) {
        if (existing) {
          return existing;
        }

        const body: Record<string, any> = {};
        if (mode === "crypto-project" && cryptoProjectId) {
          body.cryptoProjectId = cryptoProjectId;
        } else if (mode === "crypto-dashboard") {
          body.contextType = "crypto-dashboard";
        } else if (modelId) {
          body.modelId = modelId;
        }

        const res = await fetch("/api/chatkit/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Failed to create ChatKit session");
        }

        const { client_secret } = await res.json();
        return client_secret;
      },
    },
  });

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
