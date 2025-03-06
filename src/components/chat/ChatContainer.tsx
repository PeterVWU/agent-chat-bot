import { useEffect, useRef } from 'react';
// import { Button } from '../ui/button';
// import { ExternalLink } from 'lucide-react';
import { Message } from "../../types/conversation";


// const MessageLinks = ({ links }: { links: Link[] }) => {
//     return (
//         <div className="flex flex-wrap gap-2 mt-2">
//             {links.map((link, index) => (
//                 <Button
//                     key={index}
//                     variant="outline"
//                     size="sm"
//                     onClick={() => window.open(link.url, '_blank')}
//                     className="flex items-center gap-1"
//                 >
//                     {link.label}
//                     <ExternalLink className="h-3 w-3" />
//                 </Button>
//             ))}
//         </div>
//     );
// };
``
// const MessageAction = ({
//     action,
//     onActionClick
// }: { action: Action; onActionClick: (type: string, value: string) => void }) => {
//     return (
//         <div className="flex flex-wrap gap-2 mt-2">
//             <div className="flex gap-2">
//                 {action.options.map((option, optIndex) => (
//                     <Button
//                         key={optIndex}
//                         variant="outline"
//                         size="sm"
//                         onClick={() => onActionClick(action.type, option.value)}
//                     >
//                         {option.label}
//                     </Button>
//                 ))}
//             </div>
//         </div >
//     )
// }

interface ChatContainerProps {
    messages: Message[];
    onActionClick: (type: string, value: string) => void;
}
const ChatContainer = ({ messages }: ChatContainerProps) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    return (

        <>
            {messages.map((message, index) => (
                <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                    <div
                        className={`rounded-lg px-4 py-2 max-w-[80%] ${message.role === 'user'
                            ? 'bg-black text-white'
                            : 'bg-gray-100 text-gray-900'
                            }`}
                    >
                        <div>{message.content}</div>
                        {/* {message.structuredContent.links && (
                            <MessageLinks links={message.structuredContent.links} />
                        )}
                        {message.structuredContent.action?.options && (
                            <MessageAction
                                action={message.structuredContent.action}
                                onActionClick={onActionClick}
                            />
                        )} */}
                    </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
        </>
    );
};

export default ChatContainer;