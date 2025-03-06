// api/tools.ts
import {  Env, Message} from "./index";
import { CSMagentoModule } from "./tools/magento";
import { CSFaqModule } from "./tools/faq";
import { CSTicketModule } from "./tools/ticket";
// Define tool types more explicitly
export interface Tool {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: {
        type: "object";
        properties: Record<string, any>;
        required: string[];
      };
    };
  }
  
  export interface ToolExecutor {
    [key: string]: (args: any, env: Env) => Promise<any>;
  }

  // 1. Tool to get order information from Magento
export const getOrderInfoTool: Tool = {
    type: "function",
    function: {
      name: "getOrderInfo",
      description: "Retrieve order details, status, tracking information, and shipping details from Magento by order number",
      parameters: {
        type: "object",
        properties: {
          orderNumber: {
            type: "string",
            description: "Customer's order number (e.g., ORD-12345678)"
          }
        },
        required: ["orderNumber"]
      }
    }
  };
  
  // 2. Tool to search for answers using RAG in a vector database built from FAQ documents
  export const searchFaqTool: Tool = {
    type: "function",
    function: {
      name: "searchFaq",
      description: "Search for answers in the knowledge base using vector search (RAG) on FAQ documents",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Customer's question or query"
          }
        },
        required: ["query"]
      }
    }
  };
  
  // 3. Tool to create support ticket in Zoho Desk
  export const createSupportTicketTool: Tool = {
    type: "function",
    function: {
      name: "createSupportTicket",
      description: "Create a support ticket for the customer when customer",
      parameters: {
        type: "object",
        properties: {
          email: {
            type: "string",
            description: "Customer's email address"
          }
        },
        required: ["email"]
      }
    }
  };
  

  // Executor implementations for the customer support tools
export const toolExecutors: ToolExecutor = {
    getOrderInfo: async ({ orderNumber,  }: { orderNumber: string }, env: Env) => {
        const magento = new CSMagentoModule(env);
        magento.getOrderDetails(orderNumber);
    },
    
    searchFaq: async ({ 
      query 
    }: { 
      query: string
    }, env: Env) => {
      const faq = new CSFaqModule(env.AI, env.VECTORIZE);
      return faq.searchFAQ(query);
    },
    
    createSupportTicket: async ({ 
      email, 
      messages
    }: { 
      email: string; 
      messages: Message[] 
    }, env: Env) => {
        const ticket = new CSTicketModule(env);
        ticket.createTicket(email, messages);
    }
  };


  
  // Export all tools
  export const allTools: Tool[] = [
    getOrderInfoTool,
    searchFaqTool,
    createSupportTicketTool
  ];