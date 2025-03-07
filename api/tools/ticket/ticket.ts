
import { Message ,Env} from "../../index";
import { ZohoTicketPayload } from "./ticket.type"

export function createTicketTool(env: Env){
    return {
        name: "createSupportTicket",
        description: "Create a support ticket for the customer when customer inquery anything other then order lookup. such as cancel, refund, update, etc.",
        parameters: {
          type: "object",
          properties: {
            email: {
              type: "string",
              description: "Customer's email address"
            }
          },
          required: ["email"]
        },
        function: async ({ email, messages }: { email: string, messages: Message[] }) => {
            return await createTicket(email, messages, env);
        }
    }
}

async function createTicket(email: string, messages: Message[], env:Env): Promise<string> {
    const baseUrl = env.ZOHO_DESK_URL;
    const orgId = env.ZOHO_ORG_ID;
    const departmentId = env.ZOHO_DEPARTMENT_ID;
    const contactId = env.ZOHO_CONTACT_ID;
    const zohoOauthWorker = env.ZOHO_OAUTH_WORKER;
    try {
        console.log('messages:', messages);
        const payload = prepareTicketPayload(email, messages, departmentId, contactId);

        // Get valid access token
        const accessToken = await zohoOauthWorker.getAccessToken();
        const response = await fetch(`${baseUrl}/api/v1/tickets`, {
            method: 'POST',
            headers: {
                'orgId': orgId,
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

function prepareTicketPayload(email: string, messages: Message[],departmentId: string, contactId: string): ZohoTicketPayload {
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
        departmentId: departmentId,
        contactId: contactId,
        description: description,
        priority: 'Medium',
        status: 'Open',
        channel: 'Chat',
    };
}