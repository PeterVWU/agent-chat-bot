// api/index.ts
import { generateContent, extractText, extractFunctionCalls, type FunctionDeclaration, type FunctionCall, type FunctionResponse } from './vertexRestApi';
import { getOrderStatusTool } from "./tools/getOrderStatus/getOrderStatus";
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
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  GOOGLE_VERTEX_PROJECT: string;
  GOOGLE_VERTEX_LOCATION: string;
  GOOGLE_MODEL: string;
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

    // Process with tools for all queries - let the LLM decide whether to use tools
    const aiResponse = await processWithTools(messages, env);

    // Create assistant message from response
    const assistantMessage = {
      role: "assistant" as const,
      content: aiResponse
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

// Convert our tools to Google Generative AI tool format
function convertToGoogleTools(tools: any[]): FunctionDeclaration[] {
  return tools.map(tool => {
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    };
  });
}

// Process with tools using Google Generative AI
async function processWithTools(messages: Message[], env: Env): Promise<string> {
  console.log('Processing with tools');
  // Initialize tools
  const toolImplementations = [
    getOrderStatusTool(env),
    searchFAQTool(env),
    createTicketTool(env, messages)
  ];

  // Convert to Google API format
  const googleTools = convertToGoogleTools(toolImplementations);
  console.log('Google tools:', googleTools);

  // System instruction
  const systemInstruction = {
    role: 'system',
    parts: [{
      text: `You are a concise customer service assistant with access to tools.
      Instructions for handling requests:
      1. For order status inquiries, use the getOrderStatus tool, always ask for the order number first.
      2. For all other order inquiries, use the createTicket tool to create ticket.
      3. For support requests, use the createTicket tool, always ask for customer email first.
      4. For FAQ queries, provide a brief answer from the search result.
      5. Keep responses brief with 1 sentence or less.`
    }]
  };

  // Safety settings
  const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  ];

  // Format conversation history for Vertex AI
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  try {
    // Function to handle tool calls
    const handleToolCalls = async (toolCalls: FunctionCall[]): Promise<FunctionResponse[]> => {
      const toolResults = [];
      console.log("Tool calls:", toolCalls);
      for (const toolCall of toolCalls) {
        const { name, args } = toolCall;

        // Find the matching tool implementation
        const tool = toolImplementations.find(t => t.name === name);
        if (tool) {
          try {
            // Execute the tool function with the provided arguments
            const result = await tool.function(args as any);
            toolResults.push({
              name: name,
              response: result
            });
          } catch (error) {
            console.error(`Error executing tool ${name}:`, error);
            toolResults.push({
              name: name,
              response: { error: error instanceof Error ? error.message : String(error) }
            });
          }
        }
      }

      return toolResults;
    };

    // First API call with user's message
    let response = await generateContent(env, {
      contents,
      systemInstruction,
      safetySettings,
      tools: [{ functionDeclarations: googleTools }],
    });

    // Extract text and function calls
    let responseText = extractText(response);
    const functionCalls = extractFunctionCalls(response);

    // If there are function calls, execute them and get final response
    if (functionCalls.length > 0) {
      // Execute the tool calls
      const toolResults = await handleToolCalls(functionCalls);
      console.log("toolResults:", toolResults);

      // Add function call and response to conversation
      const updatedContents = [
        ...contents,
        {
          role: 'model',
          parts: functionCalls.map(fc => ({ functionCall: fc }))
        },
        {
          role: 'user',
          parts: toolResults.map(result => ({ functionResponse: result }))
        }
      ];

      // Get final response from model
      const finalResponse = await generateContent(env, {
        contents: updatedContents,
        systemInstruction,
        safetySettings,
        tools: [{ functionDeclarations: googleTools }],
      });

      responseText = extractText(finalResponse);
    }

    return responseText;
  } catch (error) {
    console.error("Google Generative AI request failed:", error);
    return "I'm sorry, I encountered a problem while processing your request. Please try again.";
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
    console.log("request url", url.pathname);

    if (url.pathname.startsWith("/api")) {
      return handleRequest(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};