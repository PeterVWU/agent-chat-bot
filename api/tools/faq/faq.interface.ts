// src/modules/faq.interface.ts
export interface FaqModule {
    searchFAQ(query: string): Promise<string | null>;
}

export interface FAQResult {
    question: string;
    answer: string;
    shortAnswer?: string;
    linkUrl?: string;
    confidence: number;
}