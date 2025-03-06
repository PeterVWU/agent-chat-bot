// src/modules/faq/faq.module.ts
import { FaqModule } from "./faq.interface"

export class CSFaqModule implements FaqModule {
    private ai: Ai;
    private vectorize: Vectorize;
    constructor(
        env: {
            AI: Ai,
            VECTORIZE: Vectorize
        }
    ) {
        this.ai = env.AI;
        this.vectorize = env.VECTORIZE;
    }
    async searchFAQ(query: string): Promise<string | null> {
        console.log('this.ai', this.ai)
        console.log('this.vectorize', this.vectorize)
        try {
            const embedding = await this.generateEmbedding(query);

            const searchResults = await this.vectorize.query(embedding, {
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
                answer: string,
                shortAnswer?: string,
                linkUrl?: string
            };
            return bestMatch.score > 0.7 ? metadata.answer : null;

        } catch (error) {
            console.error('Error searching FAQs:', error);
            return null;
        }
    }

    private async generateEmbedding(query: string): Promise<number[]> {
        try {
            const response = await this.ai.run('@cf/baai/bge-base-en-v1.5', {
                text: query
            });

            return response.data[0];
        } catch (error) {
            console.error('Error generating query embedding:', error);
            throw new Error('Failed to generate embedding');
        }
    }
    // private generateFaqLink(question: string): string {
    //     const encodedQuestion = encodeURIComponent(question.toUpperCase());
    //     return `https://staging.vapewholesaleusa.com/faqs#:~:text=${encodedQuestion}`;
    // }
}