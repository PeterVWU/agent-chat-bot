// src/modules/faq/faq.module.ts
import { FaqModule ,FAQResult} from "./faq.interface"

export class CSFaqModule implements FaqModule {
    constructor(
        private ai: Ai,
        private vectorize: Vectorize
    ) { }
    async searchFAQ(query: string): Promise<FAQResult | null> {
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

            return {
                question: metadata.question,
                answer: metadata.answer,
                shortAnswer: metadata.shortAnswer || await this.generateShortAnswer(metadata.answer),
                linkUrl: metadata.linkUrl || this.generateFaqLink(metadata.question),
                confidence: bestMatch.score
            }
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

    private async generateShortAnswer(fullAnswer: string): Promise<string> {
        try {
            const response: any = await this.ai.run('@cf/meta/llama-2-7b-chat-int8', {
                messages: [
                    {
                        role: 'system',
                        content: 'Summarize the following answer in 1 short sentences.'
                    },
                    {
                        role: 'user',
                        content: fullAnswer
                    }
                ],
                max_tokens: 100
            });
            return response.response.trim();
        } catch (error) {
            console.error('Error generating short answer:', error);
            // Return first 100 characters if AI summarization fails
            return fullAnswer.slice(0, 100) + '...';
        }
    }

    private generateFaqLink(question: string): string {
        const encodedQuestion = encodeURIComponent(question.toUpperCase());
        return `https://staging.vapewholesaleusa.com/faqs#:~:text=${encodedQuestion}`;
    }
}