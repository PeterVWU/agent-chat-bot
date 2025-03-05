// src/modules/faq.interface.ts
export interface FaqModule {
    searchFAQ(query: string): Promise<FAQResult | null>;
}

export interface FAQResult {
    question: string;
    answer: string;
    shortAnswer?: string;
    linkUrl?: string;
    confidence: number;
}