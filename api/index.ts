// export type Env = {
//   OPENAI_API_KEY: string;
//   ASSETS: {
//     fetch: typeof fetch;
//   };
// };


// export default {
//     async fetch(request: Request, env:Env) {
//       const url = new URL(request.url);
//       console.log("API request", url.pathname);
  
//       if (url.pathname.startsWith("/api/")) {
//         console.log("API request", url.pathname);
//         return new Response(JSON.stringify({ name: "Cloudflare" }), {
//           headers: { "Content-Type": "application/json" },
//         });
//       }
  
//        return env.ASSETS.fetch(request);
//     },
//   };

  import { allTools, toolExecutors,Tool } from './tools';

// Define environment type
export interface Env {
  CONVERSATIONS: KVNamespace; // Cloudflare KV namespace for storing conversations
  AI: any; // Workers AI binding
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
      return new Response(`${request.method } Method not allowed`, { status: 405 });
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

      // Using Workers AI with Llama model
      let aiResponse;
      
      // Check if the last message has potential for a tool call
      const lastUserMessage = messages[messages.length - 1].content.toLowerCase();
      const needsTools = this.determineToolNeed(lastUserMessage);
      
      if (needsTools) {
        // Call the AI model with tool capabilities
        aiResponse = await this.processWithTools(formattedMessages);
      } else {
        // Standard AI call without tools
        aiResponse = await this.processStandardQuery(formattedMessages);
      }
      
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
  
  // Process query using Workers AI without tools
  private async processStandardQuery(messages: Message[]): Promise<string> {
    try {
      // Use the AI binding to call the Llama model
      const result = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: messages
      });
      
      return result.response;
    } catch (error) {
      console.error("Workers AI request failed:", error);
      throw error;
    }
  }
  
  // Process with tools using a specialized prompt since Workers AI doesn't natively support function calling
  private async processWithTools(messages: Message[]): Promise<string> {
    // Create a special system message that instructs the model about available tools
    const toolsDescription = allTools.map((tool:Tool) => {
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
      content: `You are a helpful assistant with access to tools. When a user's request requires using a tool, respond in the following JSON format:
{
  "tool": "toolName",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  },
  "reasoning": "Brief explanation of why you're using this tool"
}

Available tools:
${toolsDescription}

If the user's request doesn't require a tool, respond normally without using JSON format.`
    };
    
    // Add the tools system message and make the request
    const extendedMessages = [toolsSystemMessage, ...messages];
    
    try {
      // Use the AI binding to call the Llama model
      const result = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: extendedMessages
      });
      
      const aiResponse = result.response;
      
      // Check if the response is a tool call (JSON format)
      try {
        // Try to parse as JSON to see if it's a tool call
        const jsonResponse = this.extractJSON(aiResponse);
        
        if (jsonResponse && jsonResponse.tool && jsonResponse.parameters) {
          // It's a tool call, execute the tool
          const toolName = jsonResponse.tool;
          const toolParams = jsonResponse.parameters;
          
          if (toolExecutors[toolName]) {
            // Execute the tool
            const toolResult = await toolExecutors[toolName](toolParams);
            
            // Format a nice response with both the tool result and reasoning
            return `I've used the ${toolName} tool to help answer your question.

${jsonResponse.reasoning || ''}

Here's what I found:
${JSON.stringify(toolResult, null, 2)}`;
          } else {
            return `I wanted to use the ${toolName} tool, but it's not available. Here's what I can tell you instead: ${aiResponse}`;
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
  
  // Simple heuristic to determine if a message might need tools
  private determineToolNeed(message: string): boolean {
    const toolKeywords = [
      'time', 'what time', 'current time',
      'calculate', 'compute', 'math', 'equation',
      'convert currency', 'exchange rate',
      'weather', 'temperature', 'forecast',
      'product', 'find product', 'search for'
    ];
    
    return toolKeywords.some(keyword => message.includes(keyword));
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