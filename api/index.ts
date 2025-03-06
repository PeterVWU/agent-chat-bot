// api/index.ts
import { allTools, toolExecutors, Tool } from './tools';

// Define environment type
export interface Env {
  CONVERSATIONS: KVNamespace; // Cloudflare KV namespace for storing conversations
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
export class SimpleChatHandler {
  env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async handleRequest(request: Request) {
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
      const conversationId = body.conversationId || this.generateConversationId();

      // Load existing conversation if available
      let messages = body.messages;

      if (body.conversationId) {
        const existingConversation = await this.getConversation(conversationId);
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
      const aiResponse = await this.processWithTools(formattedMessages, this.env);

      // Create assistant message from response
      const assistantMessage = {
        role: "assistant" as const,
        content: aiResponse
      };

      // Update messages with the final response
      messages = [...messages, assistantMessage];

      // Save the conversation
      await this.saveConversation(conversationId, messages);

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
  private async processWithTools(messages: Message[], env: Env): Promise<string> {
    // Create a special system message that instructs the model about available tools
    const toolsDescription = allTools.map((tool: Tool) => {
      const params = Object.entries(tool.function.parameters.properties)
        .map(([name, prop]) => `- ${name} (${prop.type}): ${prop.description || ''}`)
        .join('\n');

      return `
Tool: ${tool.function.name}
Description: ${tool.function.description}
Parameters:
${params}
Required: ${tool.function.parameters.required.join(', ') || 'None'}
    `;
    }).join('\n\n');

    // Build a special system message that explains how to use tools
    const toolsSystemMessage = {
      role: "system" as const,
      content: `You are a concise customer service assistant with access to tools. When a user's request requires using a tool, respond in the following JSON format:
{
  "tool": "toolName",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}

Available tools:
${toolsDescription}

Instructions for handling requests:
1. For order inquiries, always ask for the order number first.
2. For support requests, always ask for customer email first if no email is provided is conversation before calling the createSupportTicket tool.
3. Keep responses brief (1-2 sentences) and conversational.`
    };

    // Add the tools system message and make the request
    const extendedMessages = [toolsSystemMessage, ...messages];

    try {
      // Use the AI binding to call the Llama model
      const result: any = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: extendedMessages
      });

      const aiResponse = result.response;
      console.log('airesponse:', aiResponse);
      // Check if the response is a tool call (JSON format)
      try {
        // Try to parse as JSON to see if it's a tool call
        const jsonResponse = this.extractJSON(aiResponse);

        if (jsonResponse && jsonResponse.tool && jsonResponse.parameters) {
          // It's a tool call, execute the tool
          const toolName = jsonResponse.tool;
          const toolParams = jsonResponse.parameters;
          console.log("Tool call:", toolName, toolParams);

          if (toolExecutors[toolName]) {
            // Execute the tool
            let toolResult = null
            if (toolName === "createSupportTicket") {
              toolResult = await toolExecutors['createSupportTicket']({ ...toolParams, messages }, env);
            } else {
              toolResult = await toolExecutors[toolName](toolParams, env);
            }
            console.log('toolResult:', toolResult);
            // Now pass the tool result back to the model to generate a natural response
            const toolResultMessage = {
              role: "system" as const,
              content: `You previously decided to use the ${toolName} tool with parameters ${JSON.stringify(toolParams)}. 
The tool returned the following result: ${JSON.stringify(toolResult)}. 
Respond to the user's original request based on this information in a natural, conversational way. 
Do not mention that you used a tool or include raw JSON in your response. Just provide the information they need in a simple readable format, keep responses brief (1-2 sentences).`
            };

            // Call the model again with the original messages plus the tool result
            const finalResult: any = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
              messages: [...messages, toolResultMessage]
            });

            return finalResult.response;
          } else {
            return `I'm sorry, but I couldn't find the information you're looking for at the moment. Could you please try rephrasing your question?`;
          }
        }
      } catch (error) {
        // Not a valid JSON response, that's fine
      }

      // If we get here, it's not a tool call or JSON parsing failed, return the original response
      return aiResponse;
    } catch (error) {
      console.error("Workers AI request failed:", error);
      throw error;
    }
  }

  // Helper function to extract JSON from a string that might contain text before/after the JSON
  private extractJSON(text: string): any {
    const jsonRegex = /{[\s\S]*}/;
    const match = text.match(jsonRegex);

    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  // Generate a unique conversation ID
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Save conversation to KV
  private async saveConversation(conversationId: string, messages: Message[]): Promise<void> {
    await this.env.CONVERSATIONS.put(
      conversationId,
      JSON.stringify(messages),
      { expirationTtl: 60 * 60 * 24 * 30 } // Store for 30 days
    );
  }

  // Get conversation from KV
  private async getConversation(conversationId: string): Promise<Message[] | null> {
    const conversation = await this.env.CONVERSATIONS.get(conversationId);
    if (!conversation) return null;

    try {
      return JSON.parse(conversation) as Message[];
    } catch (error) {
      console.error("Error parsing conversation:", error);
      return null;
    }
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    console.log("API request", url.pathname);

    if (url.pathname.startsWith("/api")) {

      // Create an instance of the chat handler
      const chatHandler = new SimpleChatHandler(env);

      // Process the request
      return chatHandler.handleRequest(request);
    }
    return env.ASSETS.fetch(request);
  },
};