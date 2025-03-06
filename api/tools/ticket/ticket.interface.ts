// src/modules/ticket.interface.ts
import { Message } from "../../index";
export interface TicketModule {
    createTicket(email: string, messages: Message[]): Promise<string>;
}

export interface TicketMetadata {
    ticketId: string;
    status: string;
    createdTime: string;
}

export interface ZohoTicketPayload {
    subject: string;
    departmentId: string;
    contactId: string;
    email: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
    status: string;
    channel: string;
}