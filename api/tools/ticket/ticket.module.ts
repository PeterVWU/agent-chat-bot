// src/modules/ticket/ticket.module.ts
import { Message } from "../../index";
import { TicketModule, ZohoTicketPayload } from "./ticket.interface"

export class CSTicketModule implements TicketModule {
    private baseUrl: string;
    private orgId: string;
    private departmentId: string;
    private contactId: string;
    private zohoOauthWorker: any;

    constructor(env: {
        ZOHO_DESK_URL: string;
        ZOHO_ORG_ID: string;
        ZOHO_DEPARTMENT_ID: string;
        ZOHO_CONTACT_ID: string;
        ZOHO_OAUTH_WORKER: any;
    }) {
        this.baseUrl = env.ZOHO_DESK_URL;
        this.orgId = env.ZOHO_ORG_ID;
        this.departmentId = env.ZOHO_DEPARTMENT_ID;
        this.contactId = env.ZOHO_CONTACT_ID;
        this.zohoOauthWorker = env.ZOHO_OAUTH_WORKER;
    }
    public async createTicket(email: string, messages: Message[]): Promise<string> {
        try {
            console.log('messages:', messages);
            const payload = this.prepareTicketPayload(email, messages);

            // Get valid access token
            const accessToken = await this.zohoOauthWorker.getAccessToken();
            const response = await fetch(`${this.baseUrl}/api/v1/tickets`, {
                method: 'POST',
                headers: {
                    'orgId': this.orgId,
                    'Authorization': `Zoho-oauthtoken ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Zoho API error: ${JSON.stringify(errorData)}`);
            }

            const ticketData = await response.json();
            console.log('Ticket created successfully:', ticketData);
            return "Ticket created successfully"
        } catch (error) {
            console.error('Error creating ticket:', error);
            throw new Error('Failed to create support ticket');
        }
    }

    private prepareTicketPayload(email: string, messages: Message[]): ZohoTicketPayload {
        // // Get all messages from the conversation for context
        // const recentMessages = conversation.messages
        //     .map(msg => `${msg.sender}: ${msg.structuredContent.text}`)
        //     .join('\n');

        // // Create subject from the first user message or a default
        // const firstUserMessage = conversation.messages.find(msg => msg.sender === 'user')?.structuredContent.text;
        // const subject = firstUserMessage ?
        //     `${firstUserMessage.slice(0, 50)}${firstUserMessage.length > 50 ? '...' : ''}` :
        //     'Customer Support Request';

        // const orderContext = conversation.metadata.orderNumber ?
        //     `\nOrder Number: ${conversation.metadata.orderNumber}` : '';

        // Format messages with HTML line breaks and proper styling
        const recentMessages = messages
            .map(msg => {
                const sender = msg.role === 'user' ? 'Customer' : 'Bot';
                const text = msg.content.replace(/\n/g, '<br>');
                return `<strong>${sender}:</strong> ${text}`;
            })
            .join('<br><br>');

        // Create subject from the first user message or a default
        const firstUserMessage = messages.find(msg => msg.role === 'user')?.content;
        const subject = firstUserMessage ?
            `${firstUserMessage.slice(0, 50)}${firstUserMessage.length > 50 ? '...' : ''}` :
            'Customer Support Request';

        // Construct the HTML-formatted description
        const description = `
        <h3>Chat Conversation History</h3>
        <div style="margin-top: 10px;">
            ${recentMessages}
        </div>
    `.trim();

        return {
            subject,
            email,
            departmentId: this.departmentId,
            contactId: this.contactId,
            description: description,
            priority: 'Medium',
            status: 'Open',
            channel: 'Chat',
        };
    }
}