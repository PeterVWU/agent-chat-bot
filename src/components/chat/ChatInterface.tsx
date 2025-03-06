// src/components/chat/ChatInterface.tsx
import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Send } from 'lucide-react';
import { Message, ChatResponse } from "../../types/conversation";
import ChatContainer from "./ChatContainer";


const ChatInterface = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: "👋 Hi there! I'm your customer service assistant. How can I help you today?"
        }]);
    const [newMessage, setNewMessage] = useState('');
    const [conversationId, setConversationId] = useState<string | undefined>();

    const sendMessage = async (): Promise<ChatResponse> => {
        const response = await fetch('/api', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages,
                conversationId,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to send message');
        }

        return response.json();
    };

    const mutation = useMutation({
        mutationFn: sendMessage,
        onSuccess: (data) => {
            setConversationId(data.conversationId);

            // Add the assistant's message
            if (data.message && data.message.content) {
                setMessages(prev => [
                    ...prev,
                    { role: 'assistant', content: data.message.content }
                ]);
            }
            setNewMessage('');
        },
    });

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        setMessages(prev => [...prev, {
            role: 'user',
            content: newMessage
        }]);

        mutation.mutate();
    };

    const handleActionClick = (type: string, value: string) => {
        console.log('Action clicked:', type, value);
        let message: string;
        if (type === 'feedback') {
            message = value === 'helpful'
                ? "FEEDBACK_HELPFUL"
                : "FEEDBACK_UNHELPFUL";
        } else {
            message = value === 'create'
                ? "TICKET_CREATE"
                : "";
        }
        setNewMessage(message)
        mutation.mutate();
    }

    return (
        <Card className="w-full max-w-md mx-auto h-[600px] flex flex-col">
            <div className="p-4 border-b flex items-center gap-3">
                <h2 className="text-lg font-semibold text-center">Customer Support</h2>

            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                <ChatContainer messages={messages}
                    onActionClick={handleActionClick} />

                {mutation.isPending && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-lg px-4 py-2">
                            Typing...
                        </div>
                    </div>
                )}
            </div>

            <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1"
                />
                <Button
                    type="submit"
                    size="icon"
                    disabled={mutation.isPending}
                >
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </Card>
    );
};

export default ChatInterface;