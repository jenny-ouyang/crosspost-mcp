#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── Configuration ────────────────────────────────────────────────

const API_KEY = process.env.CROSSPOST_API_KEY;
const API_URL = process.env.CROSSPOST_API_URL || "https://crosspost-app.vercel.app";

if (!API_KEY) {
  console.error("Error: CROSSPOST_API_KEY environment variable is required.");
  console.error("Get your API key from the CrossPost dashboard.");
  process.exit(1);
}

// ─── API Client ───────────────────────────────────────────────────

async function apiRequest(
  endpoint: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: unknown
): Promise<unknown> {
  const url = `${API_URL}/api/v1${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// ─── MCP Server ───────────────────────────────────────────────────

const server = new McpServer({
  name: "crosspost-mcp",
  version: "0.1.0",
});

// ─── Tool: list_accounts ──────────────────────────────────────────

server.tool(
  "list_accounts",
  "List all connected social media accounts and their status",
  {},
  async () => {
    const data = (await apiRequest("/accounts")) as {
      accounts: Array<{
        platform: string;
        platformHandle: string;
        isActive: boolean;
        tokenStatus: string;
      }>;
    };

    if (!data.accounts || data.accounts.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No connected accounts. Visit the CrossPost dashboard to connect your social media accounts.",
          },
        ],
      };
    }

    const lines = data.accounts.map(
      (a) =>
        `- ${a.platform}: ${a.platformHandle} (${a.tokenStatus})`
    );

    return {
      content: [
        {
          type: "text" as const,
          text: `Connected accounts:\n${lines.join("\n")}`,
        },
      ],
    };
  }
);

// ─── Tool: create_post ────────────────────────────────────────────

server.tool(
  "create_post",
  "Create and publish (or schedule) a post across social media platforms. Each variant is platform-specific text. If scheduleAt is provided, the post is scheduled for later; otherwise it publishes immediately.",
  {
    variants: z
      .array(
        z.object({
          platform: z.enum(["x", "bluesky", "linkedin", "threads", "instagram"]),
          text: z.string().describe("The platform-specific post text"),
        })
      )
      .min(1)
      .describe("Array of platform-specific post variants"),
    scheduleAt: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .describe("ISO 8601 datetime to schedule the post (null = publish immediately)"),
  },
  async ({ variants, scheduleAt }) => {
    const data = (await apiRequest("/posts", "POST", {
      variants,
      scheduleAt: scheduleAt || null,
    })) as {
      post: {
        id: string;
        status: string;
        variants: Array<{
          platform: string;
          status: string;
          scheduledAt?: string;
          publishedAt?: string;
          platformPostUrl?: string;
          errorMessage?: string;
        }>;
      };
    };

    const post = data.post;
    const variantSummaries = post.variants.map((v) => {
      let line = `- ${v.platform}: ${v.status}`;
      if (v.platformPostUrl) line += ` (${v.platformPostUrl})`;
      if (v.scheduledAt) line += ` (scheduled for ${v.scheduledAt})`;
      if (v.errorMessage) line += ` - Error: ${v.errorMessage}`;
      return line;
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `Post ${post.id} (${post.status}):\n${variantSummaries.join("\n")}`,
        },
      ],
    };
  }
);

// ─── Tool: list_posts ─────────────────────────────────────────────

server.tool(
  "list_posts",
  "List recent posts with their status across all platforms",
  {
    status: z
      .enum(["draft", "scheduled", "partially_published", "published", "failed"])
      .optional()
      .describe("Filter by post status"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Number of posts to return (default 20)"),
  },
  async ({ status, limit }) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (limit) params.set("limit", String(limit));

    const data = (await apiRequest(
      `/posts?${params.toString()}`
    )) as {
      posts: Array<{
        id: string;
        baseText: string;
        status: string;
        createdAt: string;
        variants: Array<{
          platform: string;
          status: string;
          platformPostUrl?: string;
        }>;
      }>;
    };

    if (!data.posts || data.posts.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No posts found." }],
      };
    }

    const summaries = data.posts.map((p) => {
      const platforms = p.variants
        .map((v) => `${v.platform}:${v.status}`)
        .join(", ");
      const preview =
        p.baseText.length > 80
          ? p.baseText.substring(0, 80) + "..."
          : p.baseText;
      return `[${p.status}] ${preview}\n  Platforms: ${platforms}\n  Created: ${p.createdAt}`;
    });

    return {
      content: [
        {
          type: "text" as const,
          text: summaries.join("\n\n"),
        },
      ],
    };
  }
);

// ─── Tool: get_post ───────────────────────────────────────────────

server.tool(
  "get_post",
  "Get detailed status of a specific post and all its platform variants",
  {
    postId: z.string().describe("The post ID to look up"),
  },
  async ({ postId }) => {
    const data = (await apiRequest(`/posts/${postId}`)) as {
      post: {
        id: string;
        baseText: string;
        status: string;
        createdAt: string;
        variants: Array<{
          platform: string;
          platformText: string;
          status: string;
          scheduledAt?: string;
          publishedAt?: string;
          platformPostUrl?: string;
          errorMessage?: string;
          connectedAccount?: { platformHandle: string };
          logs?: Array<{ event: string; createdAt: string }>;
        }>;
      };
    };

    const post = data.post;
    const variantDetails = post.variants.map((v) => {
      let detail = `\n  ${v.platform} (${v.connectedAccount?.platformHandle || "unknown"}):\n`;
      detail += `    Status: ${v.status}\n`;
      detail += `    Text: ${v.platformText}\n`;
      if (v.scheduledAt) detail += `    Scheduled: ${v.scheduledAt}\n`;
      if (v.publishedAt) detail += `    Published: ${v.publishedAt}\n`;
      if (v.platformPostUrl) detail += `    URL: ${v.platformPostUrl}\n`;
      if (v.errorMessage) detail += `    Error: ${v.errorMessage}\n`;
      return detail;
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `Post ${post.id} (${post.status})\nBase text: ${post.baseText}\nCreated: ${post.createdAt}\n\nVariants:${variantDetails.join("")}`,
        },
      ],
    };
  }
);

// ─── Tool: cancel_post ────────────────────────────────────────────

server.tool(
  "cancel_post",
  "Cancel all pending/scheduled variants of a post",
  {
    postId: z.string().describe("The post ID to cancel"),
  },
  async ({ postId }) => {
    const data = (await apiRequest(`/posts/${postId}`, "PATCH", {
      action: "cancel",
    })) as { success: boolean; message: string };

    return {
      content: [
        {
          type: "text" as const,
          text: data.message || "Post cancelled.",
        },
      ],
    };
  }
);

// ─── Tool: reschedule_post ────────────────────────────────────────

server.tool(
  "reschedule_post",
  "Move a scheduled post to a new time",
  {
    postId: z.string().describe("The post ID to reschedule"),
    scheduleAt: z
      .string()
      .datetime()
      .describe("New ISO 8601 datetime for the post"),
  },
  async ({ postId, scheduleAt }) => {
    const data = (await apiRequest(`/posts/${postId}`, "PATCH", {
      action: "reschedule",
      scheduleAt,
    })) as { success: boolean; message: string };

    return {
      content: [
        {
          type: "text" as const,
          text: data.message || `Post rescheduled to ${scheduleAt}.`,
        },
      ],
    };
  }
);

// ─── Tool: list_scheduled ─────────────────────────────────────────

server.tool(
  "list_scheduled",
  "Show all upcoming scheduled posts as a calendar view",
  {},
  async () => {
    const data = (await apiRequest("/scheduled")) as {
      scheduled: Array<{
        id: string;
        baseText: string;
        variants: Array<{
          platform: string;
          scheduledAt: string;
          connectedAccount?: { platformHandle: string };
        }>;
      }>;
    };

    if (!data.scheduled || data.scheduled.length === 0) {
      return {
        content: [
          { type: "text" as const, text: "No upcoming scheduled posts." },
        ],
      };
    }

    const lines = data.scheduled.map((p) => {
      const preview =
        p.baseText.length > 60
          ? p.baseText.substring(0, 60) + "..."
          : p.baseText;
      const schedule = p.variants
        .map(
          (v) =>
            `    ${v.platform} (${v.connectedAccount?.platformHandle || ""}): ${v.scheduledAt}`
        )
        .join("\n");
      return `"${preview}"\n${schedule}`;
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `Upcoming scheduled posts:\n\n${lines.join("\n\n")}`,
        },
      ],
    };
  }
);

// ─── Start Server ─────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CrossPost MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
