import { Env } from "../../index";
export function searchFAQTool(env: Env) {
    return {
        name: "searchFaq",
        description: "Retrieves answers from the FAQ database based on the user's question. Uses vector search to find the most relevant response, ensuring accurate and helpful answers to general inquiries.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Customer's question or query"
                }
            },
            required: ["query"]
        },
        function: async ({ query }: { query: string }) => {
            return await searchFAQ(query, env);
        }
    }
}

async function searchFAQ(query: string, env: Env): Promise<string | null> {

    try {
        const embedding = await generateEmbedding(query, env);

        const searchResults = await env.VECTORIZE.query(embedding, {
            topK: 1,
            returnValues: true,
            returnMetadata: "all"
        });
        searchResults.matches.forEach((match) => {
            console.log('match', match)
        })
        if (!searchResults.matches.length) {
            return null;
        }

        const bestMatch = searchResults.matches[0];
        const metadata = bestMatch.metadata as {
            question: string,
            answer: string
        };
        console.log('bestmatch', bestMatch.score)
        console.log("metadata.answer", metadata.answer)

        return bestMatch.score > 0.7 ? metadata.answer : null;

    } catch (error) {
        console.error('Error searching FAQs:', error);
        return null;
    }
}

async function generateEmbedding(query: string, env: Env): Promise<number[]> {
    try {
        const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
            text: query
        });

        return response.data[0];
    } catch (error) {
        console.error('Error generating query embedding:', error);
        throw new Error('Failed to generate embedding');
    }
}

