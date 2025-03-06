export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StructuredResponse {
    text: string;
    links?: Link[];
    action?: Action;
}

export interface Action {
    type: 'feedback' | 'ticket';
    options: ActionOption[];
}

export interface ActionOption {
    label: string;
    value: string;
}

export interface Link {
    label: string;
    url: string;
    type: 'tracking' | 'faq' | 'other';
}

export interface ChatResponse {
    message: Message;
    conversationId: string;
}
export type Intent =
    | 'order'             // order related
    // | 'product'           // product related
    // | 'payment'           // payment related
    // | 'shipping'          // shipping related
    // | 'return'            // return related
    // | 'cancel'            // cancel related
    | 'other'             // other related
    | 'ticketing'