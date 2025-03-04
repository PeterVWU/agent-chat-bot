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
    [key: string]: (args: any) => Promise<any>;
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
      description: "Create a new support ticket in Zoho Desk for the customer",
      parameters: {
        type: "object",
        properties: {
          email: {
            type: "string",
            description: "Customer's email address"
          },
          subject: {
            type: "string",
            description: "Subject of the support ticket"
          },
          description: {
            type: "string",
            description: "Detailed description of the issue"
          },
          priority: {
            type: "string",
            enum: ["Low", "Medium", "High", "Urgent"],
            description: "Priority level of the ticket"
          },
          category: {
            type: "string",
            enum: ["Technical Issue", "Billing", "Shipping", "Returns", "Product Information", "Other"],
            description: "Category of the support ticket"
          }
        },
        required: ["email", "subject", "description"]
      }
    }
  };
  

  // Executor implementations for the customer support tools
export const toolExecutors: ToolExecutor = {
    getOrderInfo: async ({ orderNumber }: { orderNumber: string }) => {
      // Mock implementation of order info retrieval
      // In a real implementation, this would make an API call to Magento
      
      // Simulate different order statuses based on order number to test various scenarios
      const lastChar = orderNumber.slice(-1);
      const orderStatuses = {
        "0": "Pending",
        "1": "Processing",
        "2": "Shipped",
        "3": "Delivered",
        "4": "Canceled",
        "5": "On Hold",
        "6": "Backordered",
        "7": "Refunded",
        "8": "Returned",
        "9": "Complete"
      };
      
      const status = orderStatuses[lastChar as keyof typeof orderStatuses] || "Processing";
      
      // Generate mock data based on order number
      const orderInfo = {
        orderNumber,
        dateCreated: `2023-${(parseInt(lastChar) % 12) + 1}-${Math.floor(Math.random() * 28) + 1}`,
        status,
        customerInfo: {
          name: "John Doe",
          email: "customer@example.com"
        },
        items: [
          { 
            name: "Product A", 
            sku: "SKU-123", 
            price: 49.99, 
            quantity: 1 
          },
          { 
            name: "Product B", 
            sku: "SKU-456", 
            price: 29.99, 
            quantity: 2 
          }
        ],
        shipping: {
          method: "Standard Shipping",
          address: "123 Main St, Anytown, USA",
          cost: 5.99
        },
        tracking: status === "Shipped" || status === "Delivered" ? {
          carrier: "UPS",
          trackingNumber: `1Z999AA10123456784${lastChar}`,
          estimatedDelivery: "2023-12-15",
          trackingUrl: `https://wwwapps.ups.com/tracking/tracking.cgi?tracknum=1Z999AA10123456784${lastChar}`
        } : null,
        payment: {
          method: "Credit Card",
          total: 115.96,
          currency: "USD"
        }
      };
      
      return orderInfo;
    },
    
    searchFaq: async ({ 
      query, 
      maxResults = 3 
    }: { 
      query: string; 
      maxResults?: number 
    }) => {
      // Mock implementation of vector search
      // In a real implementation, this would query a vector database
      
      // Sample FAQ entries with mock relevance scores
      const faqEntries = [
        {
          question: "How do I track my order?",
          answer: "You can track your order by logging into your account and viewing your order history, or by clicking the tracking link in your shipping confirmation email. Alternatively, provide your order number to customer support for tracking assistance.",
          category: "Shipping"
        },
        {
          question: "What is your return policy?",
          answer: "Our return policy allows returns within 30 days of delivery for most items. Products must be in original condition with tags attached and original packaging. To initiate a return, log into your account and select the order you wish to return.",
          category: "Returns"
        },
        {
          question: "How do I reset my password?",
          answer: "To reset your password, click the 'Forgot Password' link on the login page. Enter your email address and follow the instructions sent to your inbox. The reset link will expire after 24 hours for security reasons.",
          category: "Account Management"
        },
        {
          question: "Can I change or cancel my order?",
          answer: "Orders can be modified or canceled within 1 hour of placement. After that, we begin processing orders for shipment and changes may not be possible. Please contact customer support immediately if you need to modify an order.",
          category: "Orders"
        },
        {
          question: "Do you ship internationally?",
          answer: "Yes, we ship to over 50 countries worldwide. International shipping rates and delivery times vary by destination. Import duties and taxes may apply and are the responsibility of the recipient. You can view eligible countries during checkout.",
          category: "Shipping"
        },
        {
          question: "How do I contact customer support?",
          answer: "Our customer support team is available via email at support@example.com, by phone at 1-800-123-4567 from 9am-5pm EST Monday through Friday, or via live chat on our website during business hours.",
          category: "Support"
        },
        {
          question: "What payment methods do you accept?",
          answer: "We accept Visa, Mastercard, American Express, Discover, PayPal, and Apple Pay. All payment information is securely encrypted. We do not store your full credit card information on our servers.",
          category: "Billing"
        },
        {
          question: "How long does shipping take?",
          answer: "Standard shipping typically takes 3-5 business days within the continental US. Expedited shipping (2-day) and overnight options are available at checkout for most locations. Order processing takes 1-2 business days before shipment.",
          category: "Shipping"
        },
        {
          question: "Do you offer gift wrapping?",
          answer: "Yes, gift wrapping is available for $5 per item. You can select this option during checkout. We also offer gift messages at no additional charge and can omit pricing information from packing slips for gifts.",
          category: "Orders"
        },
        {
          question: "What is your warranty policy?",
          answer: "Our products come with a standard 1-year warranty against manufacturing defects. Extended warranties are available for purchase on select items. Warranty claims require proof of purchase and may require photos of the defective item.",
          category: "Product Information"
        }
      ];
      
      // Simple keyword matching to simulate vector search
      // In a real implementation, this would be a proper vector similarity search
      const keywords = query.toLowerCase().split(/\s+/);
      
      const results = faqEntries
        .map(entry => {
          // Calculate a simple relevance score based on keyword matches
          const questionMatches = keywords.filter(keyword => 
            entry.question.toLowerCase().includes(keyword)
          ).length;
          
          const answerMatches = keywords.filter(keyword => 
            entry.answer.toLowerCase().includes(keyword)
          ).length;
          
          const categoryMatches = keywords.filter(keyword => 
            entry.category.toLowerCase().includes(keyword)
          ).length;
          
          // Weight question matches higher than answer matches
          const relevanceScore = (questionMatches * 3) + answerMatches + (categoryMatches * 2);
          
          return {
            ...entry,
            relevanceScore
          };
        })
        .filter(entry => entry.relevanceScore > 0) // Only include entries with some relevance
        .sort((a, b) => b.relevanceScore - a.relevanceScore) // Sort by relevance (descending)
        .slice(0, maxResults); // Limit results
      
      return {
        query,
        resultsCount: results.length,
        results
      };
    },
    
    createSupportTicket: async ({ 
      email, 
      subject, 
      description, 
      priority = "Medium", 
      category = "Technical Issue" 
    }: { 
      email: string; 
      subject: string; 
      description: string; 
      priority?: "Low" | "Medium" | "High" | "Urgent"; 
      category?: string; 
    }) => {
      // Mock implementation of ticket creation
      // In a real implementation, this would call the Zoho Desk API
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          success: false,
          error: "Invalid email format"
        };
      }
      
      // Generate a ticket ID
      const ticketId = `TKT-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      
      // Simulate API response
      const ticket = {
        ticketId,
        email,
        subject,
        description,
        priority,
        category,
        status: "Open",
        assignedTo: "Support Team",
        createdAt: new Date().toISOString(),
        estimatedResponseTime: priority === "Urgent" ? "1 hour" : 
                               priority === "High" ? "4 hours" : 
                               priority === "Medium" ? "24 hours" : "48 hours"
      };
      
      return {
        success: true,
        message: "Support ticket created successfully",
        ticket
      };
    }
  };

  // Export all tools
  export const allTools: Tool[] = [
    getOrderInfoTool,
    searchFaqTool,
    createSupportTicketTool
  ];