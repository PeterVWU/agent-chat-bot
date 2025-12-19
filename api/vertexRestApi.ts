/**
 * Vertex AI REST API implementation for Cloudflare Workers
 * Uses direct HTTP calls instead of the Node.js SDK
 */

import { getAccessToken } from './auth/vertexAuth';

// Type definitions for Vertex AI REST API
export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: any;
}

export interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface FunctionResponse {
  name: string;
  response: any;
}

interface Part {
  text?: string;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
}

interface Content {
  role: string;
  parts: Part[];
}

interface GenerateContentRequest {
  contents: Content[];
  systemInstruction?: Content;
  tools?: Array<{
    functionDeclarations: FunctionDeclaration[];
  }>;
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

interface GenerateContentResponse {
  candidates?: Array<{
    content: {
      parts: Part[];
      role: string;
    };
    finishReason?: string;
  }>;
  promptFeedback?: any;
  usageMetadata?: any;
}

/**
 * Calls Vertex AI REST API to generate content
 */
export async function generateContent(
  env: {
    GOOGLE_SERVICE_ACCOUNT_JSON: string;
    GOOGLE_VERTEX_PROJECT: string;
    GOOGLE_VERTEX_LOCATION: string;
    GOOGLE_MODEL: string;
  },
  request: GenerateContentRequest
): Promise<GenerateContentResponse> {
  // Get access token
  const accessToken = await getAccessToken(env);

  // Construct API endpoint
  const model = env.GOOGLE_MODEL || 'gemini-2.5-flash-lite';
  const endpoint = `https://${env.GOOGLE_VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${env.GOOGLE_VERTEX_PROJECT}/locations/${env.GOOGLE_VERTEX_LOCATION}/publishers/google/models/${model}:generateContent`;

  console.log('Calling Vertex AI:', endpoint);

  // Make API request
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Vertex AI API error:', response.status, errorText);
    throw new Error(`Vertex AI API error: ${response.status} ${errorText}`);
  }

  const data: GenerateContentResponse = await response.json();
  return data;
}

/**
 * Helper to extract text from response
 */
export function extractText(response: GenerateContentResponse): string {
  const candidate = response.candidates?.[0];
  const textPart = candidate?.content?.parts?.find(part => part.text);
  return textPart?.text || '';
}

/**
 * Helper to extract function calls from response
 */
export function extractFunctionCalls(response: GenerateContentResponse): FunctionCall[] {
  const candidate = response.candidates?.[0];
  const functionCallParts = candidate?.content?.parts?.filter(part => part.functionCall) || [];
  return functionCallParts.map(part => part.functionCall!);
}
