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
  
  // Current time tool
  export const getCurrentTimeTool: Tool = {
    type: "function",
    function: {
      name: "getCurrentTime",
      description: "Get the current server time in various formats",
      parameters: {
        type: "object",
        properties: {
          format: {
            type: "string",
            enum: ["iso", "local", "unix"],
            description: "Time format (iso, local, or unix timestamp)"
          }
        },
        required: []
      }
    }
  };
  
  // Math calculation tool
  export const calculateMathTool: Tool = {
    type: "function",
    function: {
      name: "calculateMath",
      description: "Calculate a mathematical expression",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "The mathematical expression to calculate"
          }
        },
        required: ["expression"]
      }
    }
  };
  
  // Currency converter tool
  export const convertCurrencyTool: Tool = {
    type: "function",
    function: {
      name: "convertCurrency",
      description: "Convert between currencies using latest exchange rates",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "The amount to convert"
          },
          from: {
            type: "string",
            description: "Source currency code (e.g., USD, EUR, GBP)"
          },
          to: {
            type: "string",
            description: "Target currency code (e.g., USD, EUR, GBP)"
          }
        },
        required: ["amount", "from", "to"]
      }
    }
  };
  
  // Weather search tool
  export const searchWeatherTool: Tool = {
    type: "function",
    function: {
      name: "searchWeather",
      description: "Search for weather information for a location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The location to get weather for"
          }
        },
        required: ["location"]
      }
    }
  };
  
  // Product search tool
  export const searchProductTool: Tool = {
    type: "function",
    function: {
      name: "searchProduct",
      description: "Search for products in catalog",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for products"
          },
          category: {
            type: "string",
            description: "Product category (optional)"
          },
          maxPrice: {
            type: "number",
            description: "Maximum price filter (optional)"
          }
        },
        required: ["query"]
      }
    }
  };
  
  // Tool executors
  export const toolExecutors: ToolExecutor = {
    getCurrentTime: async ({ format = "iso" }) => {
      const now = new Date();
      switch (format) {
        case "iso":
          return { time: now.toISOString() };
        case "local":
          return { time: now.toLocaleString() };
        case "unix":
          return { time: Math.floor(now.getTime() / 1000) };
        default:
          return { time: now.toISOString() };
      }
    },
    
    calculateMath: async ({ expression }: { expression: string }) => {
      try {
        // Simple evaluation - for production, use a safer method
        // eslint-disable-next-line no-eval
        const result = eval(expression);
        return { result };
      } catch (error) {
        return { error: "Invalid expression" };
      }
    },
    
    convertCurrency: async ({ 
      amount, 
      from, 
      to 
    }: { 
      amount: number;
      from: string;
      to: string;
    }) => {
      // Mock exchange rates (in a real app, you would fetch these from an API)
      const rates: Record<string, number> = {
        USD: 1,
        EUR: 0.93,
        GBP: 0.79,
        JPY: 153.5,
        CAD: 1.38,
        AUD: 1.53,
        CNY: 7.24
      };
      
      const fromRate = rates[from.toUpperCase()] || 1;
      const toRate = rates[to.toUpperCase()] || 1;
      
      if (!rates[from.toUpperCase()]) {
        return { error: `Unsupported currency: ${from}` };
      }
      
      if (!rates[to.toUpperCase()]) {
        return { error: `Unsupported currency: ${to}` };
      }
      
      const convertedAmount = (amount / fromRate) * toRate;
      
      return {
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        amount,
        convertedAmount: parseFloat(convertedAmount.toFixed(2)),
        rate: parseFloat((toRate / fromRate).toFixed(4))
      };
    },
    
    searchWeather: async ({ location }: { location: string }) => {
      // Simulate weather API (in a real app, you would call a weather API)
      const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Rainy", "Stormy", "Snowy"];
      const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
      const randomTemp = Math.floor(Math.random() * 35) + 5; // 5 to 40 degrees
      const randomHumidity = Math.floor(Math.random() * 60) + 30; // 30% to 90%
      const randomWind = Math.floor(Math.random() * 30); // 0 to 30 km/h
      
      return {
        location,
        current: {
          temperature: randomTemp,
          temperatureUnit: "celsius",
          condition: randomCondition,
          humidity: randomHumidity,
          windSpeed: randomWind,
          windUnit: "km/h",
          lastUpdated: new Date().toISOString()
        },
        forecast: [
          { day: "Today", high: randomTemp + 2, low: randomTemp - 5, condition: randomCondition },
          { day: "Tomorrow", high: randomTemp + Math.floor(Math.random() * 5), low: randomTemp - Math.floor(Math.random() * 7), condition: conditions[Math.floor(Math.random() * conditions.length)] }
        ]
      };
    },
    
    searchProduct: async ({ 
      query, 
      category = "", 
      maxPrice = 1000 
    }: { 
      query: string;
      category?: string;
      maxPrice?: number;
    }) => {
      // Mock product database
      const products = [
        { id: 1, name: "Laptop Pro", category: "electronics", price: 1200, rating: 4.5 },
        { id: 2, name: "Smartphone X", category: "electronics", price: 800, rating: 4.2 },
        { id: 3, name: "Wireless Headphones", category: "electronics", price: 150, rating: 4.3 },
        { id: 4, name: "Running Shoes", category: "sports", price: 95, rating: 4.1 },
        { id: 5, name: "Yoga Mat", category: "sports", price: 40, rating: 4.0 },
        { id: 6, name: "Coffee Maker", category: "kitchen", price: 120, rating: 4.4 },
        { id: 7, name: "Blender Pro", category: "kitchen", price: 80, rating: 3.9 },
        { id: 8, name: "Fiction Book", category: "books", price: 15, rating: 4.7 },
        { id: 9, name: "Desk Lamp", category: "home", price: 35, rating: 4.0 }
      ];
      
      // Simple search implementation
      let results = products.filter(product => 
        product.name.toLowerCase().includes(query.toLowerCase()) || 
        product.category.toLowerCase().includes(query.toLowerCase())
      );
      
      // Apply category filter if provided
      if (category) {
        results = results.filter(product => 
          product.category.toLowerCase() === category.toLowerCase()
        );
      }
      
      // Apply price filter
      results = results.filter(product => product.price <= maxPrice);
      
      return {
        query,
        filters: { category, maxPrice },
        resultCount: results.length,
        results: results.slice(0, 5) // Return top 5 results
      };
    }
  };
  
  // Export all tools
  export const allTools: Tool[] = [
    getCurrentTimeTool,
    calculateMathTool,
    convertCurrencyTool,
    searchWeatherTool,
    searchProductTool
  ];