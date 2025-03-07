// api/index.ts
import { runWithTools } from "@cloudflare/ai-utils";
import { getOrderInfoTool } from "./tools/getOrderInfo/getOrderInfo";
import { searchFAQTool } from "./tools/faq/faq";
import { createTicketTool } from "./tools/ticket/ticket";

export interface Env {
  CONVERSATIONS: KVNamespace;
  AI: Ai;
  VECTORIZE: Vectorize;
  MAGENTO_API_URL: string;
  MAGENTO_API_TOKEN: string;
  ZOHO_DESK_URL: string;
  ZOHO_ORG_ID: string;
  ZOHO_DEPARTMENT_ID: string;
  ZOHO_CONTACT_ID: string;
  ZOHO_OAUTH_WORKER: any;
  ASSETS: {
    fetch: typeof fetch;
  };
}

// Define message type
export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

// Define chat request type
export interface ChatRequest {
  messages: Message[];
  conversationId?: string; // Unique identifier for the conversation
}

// Simple chat handler for Cloudflare Workers

async function handleRequest(request: Request, env: Env) {
  // Handle preflight CORS requests
  console.log("Request method:", request.method);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Only allow POST requests
  if (request.method !== "POST") {
    console.log("Method not allowed:", request.method);
    return new Response(`${request.method} Method not allowed`, { status: 405 });
  }

  try {
    // Parse request body
    const body = await request.json() as ChatRequest;

    // Generate or use existing conversation ID
    const conversationId = body.conversationId || generateConversationId();

    // Load existing conversation if available
    let messages = body.messages;

    if (body.conversationId) {
      const existingConversation = await getConversation(conversationId, env);
      if (existingConversation) {
        // Append new user message to existing conversation
        const userMessage = messages[messages.length - 1];
        if (userMessage.role === 'user') {
          messages = [...existingConversation, userMessage];
        } else {
          messages = existingConversation;
        }
      }
    }

    // Format messages for Workers AI/Llama
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Process with tools for all queries - let the LLM decide whether to use tools
    const aiResponse: any = await processWithTools(formattedMessages, env);

    // Create assistant message from response
    const assistantMessage = {
      role: "assistant" as const,
      content: aiResponse.response
    };

    // Update messages with the final response
    messages = [...messages, assistantMessage];

    // Save the conversation
    await saveConversation(conversationId, messages, env);

    // Return the final response with conversation ID
    return new Response(JSON.stringify({
      message: assistantMessage,
      conversationId
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(JSON.stringify({
      error: "Failed to process request",
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

// Process with tools using a specialized prompt since Workers AI doesn't natively support function calling
async function processWithTools(messages: Message[], env: Env): Promise<AiTextGenerationOutput> {
  const tools = [
    getOrderInfoTool(env),
    searchFAQTool(env),
    createTicketTool(env)
  ]


  // Build a special system message that explains how to use tools
  const toolsSystemMessage = {
    role: "system",
    content: `You are a concise customer service assistant with access to tools.
      Instructions for handling requests:
      1. For order status inquiries, always ask for the order number first, and return tacking number if exist.
      2. For all other order inquiries, use the createSupportTicket tool to create ticket.
      3. For support requests, always ask for customer email first.
      4. For FAQ queries, provide a brief answer from the search result.
      5. Keep responses brief with 1 sentence or less.`
  };

  // Add the tools system message and make the request
  const extendedMessages = [toolsSystemMessage, ...messages];

  try {
    const response = await runWithTools(
      env.AI as any,
      '@hf/nousresearch/hermes-2-pro-mistral-7b',
      {
        messages: extendedMessages,
        tools: tools as any
      }
    )
    console.log('response:', response);
    return response;
  } catch (error) {
    console.error("Workers AI request failed:", error);
    throw error;
  }
}

// Generate a unique conversation ID
function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Save conversation to KV
async function saveConversation(conversationId: string, messages: Message[], env: Env): Promise<void> {
  await env.CONVERSATIONS.put(
    conversationId,
    JSON.stringify(messages),
    { expirationTtl: 60 * 60 * 24 * 30 } // Store for 30 days
  );
}

// Get conversation from KV
async function getConversation(conversationId: string, env: Env): Promise<Message[] | null> {
  const conversation = await env.CONVERSATIONS.get(conversationId);
  if (!conversation) return null;

  try {
    return JSON.parse(conversation) as Message[];
  } catch (error) {
    console.error("Error parsing conversation:", error);
    return null;
  }
}


export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    console.log("API request", url.pathname);

    if (url.pathname.startsWith("/api")) {

      return handleRequest(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};