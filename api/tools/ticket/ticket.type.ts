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