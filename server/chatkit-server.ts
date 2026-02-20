import OpenAI from "openai";
import crypto from "crypto";
import {
  gatherModelContext,
  gatherCryptoProjectContext,
  gatherCryptoDashboardContext,
} from "./copilot";

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function now(): string {
  return new Date().toISOString();
}

interface ThreadMeta {
  id: string;
  title: string | null;
  created_at: string;
  status: { type: "active" };
  metadata: Record<string, any>;
}

interface ThreadItem {
  id: string;
  thread_id: string;
  type: "user_message" | "assistant_message" | "hidden_context";
  created_at: string;
  content: any[];
  status?: string;
}

interface Page<T> {
  data: T[];
  has_more: boolean;
  after: string | null;
}

const userThreads = new Map<string, Map<string, ThreadMeta>>();
const threadItems = new Map<string, ThreadItem[]>();

function getThreadsForUser(userId: string): Map<string, ThreadMeta> {
  if (!userThreads.has(userId)) userThreads.set(userId, new Map());
  return userThreads.get(userId)!;
}

function getItemsForThread(threadId: string): ThreadItem[] {
  if (!threadItems.has(threadId)) threadItems.set(threadId, []);
  return threadItems.get(threadId)!;
}

function paginate<T extends { id: string; created_at: string }>(
  rows: T[],
  after: string | null,
  limit: number,
  order: "asc" | "desc"
): Page<T> {
  const sorted = [...rows].sort((a, b) => {
    const cmp = a.created_at.localeCompare(b.created_at);
    return order === "desc" ? -cmp : cmp;
  });
  let start = 0;
  if (after) {
    const idx = sorted.findIndex((r) => r.id === after);
    if (idx >= 0) start = idx + 1;
  }
  const data = sorted.slice(start, start + limit);
  const has_more = start + limit < sorted.length;
  return {
    data,
    has_more,
    after: has_more && data.length > 0 ? data[data.length - 1].id : null,
  };
}

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({ apiKey });
}

const SYSTEM_PROMPTS: Record<string, string> = {
  financial: `You are Kozo Copilot, an expert Wall Street financial analyst embedded in a financial modeling platform. You specialize in:
- Financial statement analysis (Income Statement, Balance Sheet, Cash Flow)
- DCF valuation and WACC calculations
- Revenue forecasting and growth analysis
- Valuation methodologies (P/E, P/R, PEG, DCF)
- Financial ratios, red flags, and investment thesis development

Guidelines:
- Reference specific numbers from the model data
- Be concise, use bullet points and structured formatting
- When suggesting changes, explain impact on valuation
- Use markdown formatting
- If data is missing, point it out
- Maintain a professional, analytical tone`,

  "crypto-project": `You are Kozo Copilot, an expert crypto and DeFi analyst embedded in a crypto analysis platform. You specialize in:
- Token economics and supply dynamics (vesting, unlocks, emissions, burns)
- DeFi protocol analysis (TVL, fees, revenue, sustainability)
- Token valuation (DCF on protocol revenue, comparable analysis, network value models)
- Fundraising analysis and token allocation fairness
- On-chain metrics and supply concentration
- Whitepaper analysis

Guidelines:
- Reference specific data from the project
- Be honest about speculative tokens
- Quantify dilution impacts from upcoming unlocks
- Use markdown formatting
- Maintain a professional, analytical tone`,

  "crypto-dashboard": `You are Kozo Copilot, an expert crypto and DeFi analyst. You help with:
- Comparing projects in the user's watchlist
- Token economics concepts (vesting, emissions, burns, staking)
- DeFi protocol mechanics and revenue models
- Valuation frameworks for crypto assets
- Market trends and narrative analysis

Guidelines:
- You have context about the user's tracked projects
- Compare and contrast projects when asked
- Be concise and use markdown formatting
- If asked about a specific project in depth, suggest navigating to its analysis pages`,
};

interface ContextInfo {
  mode: string;
  modelId?: string;
  cryptoProjectId?: string;
}

async function buildSystemMessages(
  userId: string,
  contextInfo: ContextInfo
): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (contextInfo.cryptoProjectId) {
    messages.push({
      role: "system",
      content: SYSTEM_PROMPTS["crypto-project"],
    });
    const ctx = await gatherCryptoProjectContext(
      contextInfo.cryptoProjectId,
      userId
    );
    if (ctx) {
      const wpNote = ctx.whitepaper
        ? `\n\nWhitepaper attached (${ctx.whitepaper.length} chars).`
        : "";
      messages.push({
        role: "system",
        content: `Current data for ${ctx.project.name} (${ctx.project.symbol}):${wpNote}\n\n${JSON.stringify(ctx, null, 2)}`,
      });
    }
  } else if (contextInfo.mode === "crypto-dashboard") {
    messages.push({
      role: "system",
      content: SYSTEM_PROMPTS["crypto-dashboard"],
    });
    const ctx = await gatherCryptoDashboardContext(userId);
    if (ctx) {
      messages.push({
        role: "system",
        content: `Tracking ${ctx.totalTracked} projects, combined market cap $${(ctx.totalMarketCap / 1e9).toFixed(2)}B:\n\n${JSON.stringify(ctx, null, 2)}`,
      });
    }
  } else if (contextInfo.modelId) {
    messages.push({ role: "system", content: SYSTEM_PROMPTS["financial"] });
    const ctx = await gatherModelContext(contextInfo.modelId, userId);
    if (ctx) {
      messages.push({
        role: "system",
        content: `Financial model for ${ctx.company.name} (${ctx.company.ticker || "no ticker"}):\n\n${JSON.stringify(ctx, null, 2)}`,
      });
    }
  } else {
    messages.push({
      role: "system",
      content: SYSTEM_PROMPTS["crypto-dashboard"],
    });
  }

  return messages;
}

function threadItemsToMessages(
  items: ThreadItem[]
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return items
    .filter((i) => i.type === "user_message" || i.type === "assistant_message")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((item) => {
      if (item.type === "user_message") {
        const text = item.content
          .map((c: any) => c.text || "")
          .join("")
          .trim();
        return { role: "user" as const, content: text };
      } else {
        const text = item.content
          .map((c: any) => c.text || "")
          .join("")
          .trim();
        return { role: "assistant" as const, content: text };
      }
    });
}

type SSEWriter = (event: Record<string, any>) => void;

async function* streamAssistantResponse(
  userId: string,
  threadId: string,
  contextInfo: ContextInfo,
  signal?: AbortSignal
): AsyncGenerator<Record<string, any>> {
  const items = getItemsForThread(threadId);
  const systemMessages = await buildSystemMessages(userId, contextInfo);
  const historyMessages = threadItemsToMessages(items);

  const openai = getOpenAI();
  const messageId = genId("msg");

  yield {
    type: "thread.item.added",
    item: {
      id: messageId,
      thread_id: threadId,
      type: "assistant_message",
      created_at: now(),
      content: [],
      status: "in_progress",
    },
  };

  yield {
    type: "thread.item.updated",
    item_id: messageId,
    update: {
      type: "assistant_message.content_part.added",
      content_index: 0,
      content: { type: "output_text", text: "" },
    },
  };

  const stream = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [...systemMessages, ...historyMessages],
    stream: true,
    temperature: 0.7,
    max_tokens: 4096,
  });

  let fullText = "";

  for await (const chunk of stream) {
    if (signal?.aborted) {
      stream.controller.abort();
      break;
    }

    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      fullText += delta;
      yield {
        type: "thread.item.updated",
        item_id: messageId,
        update: {
          type: "assistant_message.content_part.text_delta",
          content_index: 0,
          delta,
        },
      };
    }
  }

  yield {
    type: "thread.item.updated",
    item_id: messageId,
    update: {
      type: "assistant_message.content_part.done",
      content_index: 0,
      content: { type: "output_text", text: fullText },
    },
  };

  const finalItem: ThreadItem = {
    id: messageId,
    thread_id: threadId,
    type: "assistant_message",
    created_at: now(),
    content: [{ type: "output_text", text: fullText }],
    status: "completed",
  };

  items.push(finalItem);

  yield {
    type: "thread.item.done",
    item: finalItem,
  };

  const threads = [...userThreads.values()].find((m) => m.has(threadId));
  if (threads) {
    const thread = threads.get(threadId);
    if (thread && !thread.title && fullText.length > 0) {
      thread.title =
        fullText.slice(0, 60).replace(/\n/g, " ").trim() +
        (fullText.length > 60 ? "..." : "");
      yield {
        type: "thread.updated",
        thread: { ...thread },
      };
    }
  }
}

export async function handleChatKitRequest(
  body: any,
  userId: string,
  contextInfo: ContextInfo,
  res: import("express").Response
): Promise<void> {
  const reqType = body?.type;

  switch (reqType) {
    case "threads.list": {
      const params = body.params || {};
      const threads = getThreadsForUser(userId);
      const all = Array.from(threads.values());
      const result = paginate(
        all,
        params.after || null,
        params.limit || 20,
        params.order || "desc"
      );
      res.json(result);
      return;
    }

    case "threads.get_by_id": {
      const threadId = body.params?.thread_id;
      const threads = getThreadsForUser(userId);
      const thread = threads.get(threadId);
      if (!thread) {
        res.status(404).json({ error: "Thread not found" });
        return;
      }
      res.json(thread);
      return;
    }

    case "items.list": {
      const { thread_id, limit, order, after } = body.params || {};
      const items = getItemsForThread(thread_id);
      const result = paginate(
        items,
        after || null,
        limit || 50,
        order || "asc"
      );
      res.json(result);
      return;
    }

    case "threads.update": {
      const { thread_id, title } = body.params || {};
      const threads = getThreadsForUser(userId);
      const thread = threads.get(thread_id);
      if (thread) {
        thread.title = title;
      }
      res.json({ ok: true });
      return;
    }

    case "threads.delete": {
      const threadId = body.params?.thread_id;
      const threads = getThreadsForUser(userId);
      threads.delete(threadId);
      threadItems.delete(threadId);
      res.json({ ok: true });
      return;
    }

    case "items.feedback": {
      res.json({ ok: true });
      return;
    }

    case "threads.create": {
      const input = body.params?.input;
      const userText =
        input?.content
          ?.map((c: any) => c.text || "")
          .join("")
          .trim() || "";

      const threadId = genId("thread");
      const thread: ThreadMeta = {
        id: threadId,
        title: null,
        created_at: now(),
        status: { type: "active" },
        metadata: { ...contextInfo },
      };

      const threads = getThreadsForUser(userId);
      threads.set(threadId, thread);

      const userMsgId = genId("msg");
      const userItem: ThreadItem = {
        id: userMsgId,
        thread_id: threadId,
        type: "user_message",
        created_at: now(),
        content: [{ type: "input_text", text: userText }],
      };

      getItemsForThread(threadId).push(userItem);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      const write = (event: Record<string, any>) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      write({
        type: "stream_options",
        stream_options: { allow_cancel: true },
      });

      write({ type: "thread.created", thread });
      write({ type: "thread.item.done", item: userItem });

      const abortController = new AbortController();
      res.on("close", () => abortController.abort());

      try {
        for await (const event of streamAssistantResponse(
          userId,
          threadId,
          contextInfo,
          abortController.signal
        )) {
          if (abortController.signal.aborted) break;
          write(event);
        }
      } catch (err: any) {
        console.error("ChatKit stream error:", err.message);
        write({
          type: "error",
          code: "custom",
          message: err.message || "Failed to generate response",
          allow_retry: true,
        });
      }

      res.end();
      return;
    }

    case "threads.add_user_message": {
      const { thread_id, input } = body.params || {};
      const userText =
        input?.content
          ?.map((c: any) => c.text || "")
          .join("")
          .trim() || "";

      const threads = getThreadsForUser(userId);
      const thread = threads.get(thread_id);
      if (!thread) {
        res.status(404).json({ error: "Thread not found" });
        return;
      }

      const resolvedContext: ContextInfo =
        (thread.metadata as ContextInfo) || contextInfo;

      const userMsgId = genId("msg");
      const userItem: ThreadItem = {
        id: userMsgId,
        thread_id,
        type: "user_message",
        created_at: now(),
        content: [{ type: "input_text", text: userText }],
      };
      getItemsForThread(thread_id).push(userItem);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      const write = (event: Record<string, any>) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      write({
        type: "stream_options",
        stream_options: { allow_cancel: true },
      });

      write({ type: "thread.item.done", item: userItem });

      const abortController = new AbortController();
      res.on("close", () => abortController.abort());

      try {
        for await (const event of streamAssistantResponse(
          userId,
          thread_id,
          resolvedContext,
          abortController.signal
        )) {
          if (abortController.signal.aborted) break;
          write(event);
        }
      } catch (err: any) {
        console.error("ChatKit stream error:", err.message);
        write({
          type: "error",
          code: "custom",
          message: err.message || "Failed to generate response",
          allow_retry: true,
        });
      }

      res.end();
      return;
    }

    case "threads.retry_after_item": {
      const { thread_id, item_id } = body.params || {};

      const threads = getThreadsForUser(userId);
      const thread = threads.get(thread_id);
      if (!thread) {
        res.status(404).json({ error: "Thread not found" });
        return;
      }

      const resolvedContext: ContextInfo =
        (thread.metadata as ContextInfo) || contextInfo;

      const items = getItemsForThread(thread_id);
      const itemIdx = items.findIndex((i) => i.id === item_id);
      if (itemIdx >= 0) {
        const toRemove = items.slice(itemIdx + 1);
        items.length = itemIdx + 1;

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        const write = (event: Record<string, any>) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        };

        write({
          type: "stream_options",
          stream_options: { allow_cancel: true },
        });

        for (const removed of toRemove) {
          write({ type: "thread.item.removed", item_id: removed.id });
        }

        const abortController = new AbortController();
        res.on("close", () => abortController.abort());

        try {
          for await (const event of streamAssistantResponse(
            userId,
            thread_id,
            resolvedContext,
            abortController.signal
          )) {
            if (abortController.signal.aborted) break;
            write(event);
          }
        } catch (err: any) {
          console.error("ChatKit stream error:", err.message);
          write({
            type: "error",
            code: "custom",
            message: err.message || "Failed to generate response",
            allow_retry: true,
          });
        }

        res.end();
        return;
      }

      res.status(404).json({ error: "Item not found" });
      return;
    }

    default: {
      res.status(400).json({ error: `Unsupported request type: ${reqType}` });
      return;
    }
  }
}
