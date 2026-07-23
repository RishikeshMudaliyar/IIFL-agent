import React, { useEffect, useRef } from 'react';
import { User, Sparkles } from 'lucide-react';
import classNames from 'classnames';

interface Props {
    messages: any[];
    isTyping?: boolean;
}

const MessageRenderer: React.FC<Props> = ({ messages, isTyping = false }) => {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();

        if (isToday) {
            // Show only time for today's messages
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } else {
            // Show date and time for older messages
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }
    };

    return (
        <div className={`flex-1 px-4 py-6 space-y-6 custom-scrollbar flex flex-col ${(messages.length > 0 || isTyping) ? 'overflow-y-auto' : 'overflow-hidden'}`}>
            {messages.length === 0 && !isTyping && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 min-h-[400px]">
                    <div className="w-24 h-24 bg-gradient-to-tr from-sky-100 to-sky-200 rounded-full flex items-center justify-center mb-6 shadow-sm">
                        <Sparkles size={40} className="text-sky-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">How can I help you today?</h2>
                    <p className="text-gray-500 max-w-md text-center leading-relaxed mb-6">
                        I'm your agent. I'm here to guide you through your loan application, answer your questions, and ensure a smooth experience.
                    </p>

                    {/* Suggestion Chips */}
                    <div className="flex flex-wrap gap-3 justify-center max-w-md">
                        <div className="px-5 py-3 bg-white/80 border border-sky-200 rounded-2xl rounded-br-none text-sm text-sky-600 shadow-sm transition-all cursor-default">
                            Apply for a New Loan
                        </div>
                        <div className="px-5 py-3 bg-white/80 border border-sky-200 rounded-2xl rounded-br-none text-sm text-sky-600 shadow-sm transition-all cursor-default">
                            Check Application Status
                        </div>
                        <div className="px-5 py-3 bg-white/80 border border-sky-200 rounded-2xl rounded-br-none text-sm text-sky-600 shadow-sm transition-all cursor-default">
                            Know Eligibility Criteria
                        </div>
                    </div>
                </div>
            )}

            {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const uniqueKey = `${msg.role}-${msg.timestamp}-${idx}`;

                return (
                    <div
                        key={uniqueKey}
                        className={classNames(
                            "flex gap-3 max-w-[85%] group animate-fade-in",
                            isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                        )}
                    >
                        <div className={classNames(
                            "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ring-2 ring-white",
                            isUser ? "bg-gradient-to-br from-sky-300 to-sky-400 text-gray-900" : "bg-gradient-to-br from-sky-200 to-sky-300 text-sky-700"
                        )}>
                            {isUser ? <User size={16} /> : <Sparkles size={16} />}
                        </div>

                        <div className={classNames(
                            "px-4 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm transition-all hover:shadow-md",
                            isUser
                                ? "bg-gradient-to-br from-sky-200 to-sky-300 text-gray-900 rounded-tr-md"
                                : "bg-white border border-gray-100/80 text-gray-700 rounded-tl-md"
                        )}>
                            <div className="whitespace-pre-wrap">{msg.text}</div>
                            <div className={classNames(
                                "text-[11px] mt-1.5 opacity-60",
                                isUser ? "text-gray-700/70 text-right" : "text-gray-400"
                            )}>
                                {formatTimestamp(msg.timestamp)}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Typing Indicator */}
            {isTyping && (
                <div className="flex gap-4 max-w-[85%] mr-auto animate-fade-in">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ring-2 ring-white bg-gradient-to-br from-sky-200 to-sky-300 text-sky-700">
                        <Sparkles size={18} />
                    </div>
                    <div className="bg-white border border-gray-100/80 text-gray-700 rounded-[1.5rem] rounded-tl-sm p-5 shadow-sm">
                        <div className="flex gap-1 items-center">
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                    </div>
                </div>
            )}

            <div ref={endRef} />
        </div>
    );
};

export default MessageRenderer;