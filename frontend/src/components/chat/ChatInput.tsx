import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface Props {
    onSendMessage: (text: string) => void;
    disabled: boolean;
}

const ChatInput: React.FC<Props> = ({
    onSendMessage,
    disabled,
}) => {
    const [text, setText] = useState('');

    const handleSendText = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!text.trim() || disabled) return;
        onSendMessage(text);
        setText('');
    };

    // // OTP Mode
    // if (otpState.required && !otpState.verified) {
    //     return (
    //         <div className="p-4 bg-red-50 border-t border-red-100 animate-in slide-in-from-bottom-2">
    //             <div className="max-w-sm mx-auto w-full">
    //                 <label className="block text-sm font-bold text-red-900 mb-2 flex items-center gap-2">
    //                     <KeyRound size={16} /> Enter One-Time Password
    //                 </label>
    //                 <div className="flex gap-2">
    //                     <input
    //                         type="text"
    //                         className={classNames(
    //                             "flex-1 px-4 py-2 rounded-lg border-2 outline-none font-mono text-center tracking-widest",
    //                             otpState.error
    //                                 ? "border-red-400 focus:border-red-500 bg-red-50 text-red-900"
    //                                 : "border-red-200 focus:border-[#0071A9] text-red-900"
    //                         )}
    //                         placeholder="••••••"
    //                         maxLength={6}
    //                         value={text}
    //                         onChange={(e) => setText(e.target.value)}
    //                         onKeyDown={(e) => {
    //                             if (e.key === 'Enter') {
    //                                 onSendOtp(text);
    //                                 setText('');
    //                             }
    //                         }}
    //                         autoFocus
    //                     />
    //                     <button
    //                         onClick={() => {
    //                             onSendOtp(text);
    //                             setText('');
    //                         }}
    //                         className="bg-[#0071A9] hover:bg-[#003652] text-white px-6 py-2 rounded-lg font-semibold transition-colors shadow-sm"
    //                     >
    //                         Verify
    //                     </button>
    //                 </div>
    //                 {otpState.error && (
    //                     <p className="text-xs text-red-600 mt-2 font-medium">Incorrect OTP. Please try again.</p>
    //                 )}
    //             </div>
    //         </div>
    //     );
    // }

    return (
        <form onSubmit={handleSendText} className="relative pr-1 sm:pr-0">
            <div className="absolute inset-0" />

            <div className="relative flex items-center gap-2 sm:gap-3 z-10">

                {/* Text Input */}
                <div className="flex-1 max-w-[185px] sm:max-w-none bg-white/60 hover:bg-white/80 focus-within:bg-white transition-all rounded-xl sm:rounded-2xl border border-sky-200 focus-within:border-sky-400 focus-within:ring-4 focus-within:ring-sky-100/50 flex items-center shadow-inner">
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        disabled={disabled}
                        placeholder="Type your message..."
                        className="flex-1 bg-transparent px-3 sm:px-5 py-2.5 sm:py-3.5 outline-none text-gray-700 placeholder-gray-400 disabled:opacity-50 text-sm sm:text-base"
                    />
                </div>

                {/* Send Button */}
                <button
                    type="submit"
                    disabled={!text.trim() || disabled}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-sky-300 to-sky-400 text-gray-900 rounded-full flex items-center justify-center hover:shadow-lg hover:shadow-sky-200 hover:translate-y-[-1px] disabled:bg-none disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed transition-all duration-300 transform active:scale-95 group flex-shrink-0"
                >
                    <Send size={16} className="sm:hidden translate-x-0.5 translate-y-0.5 group-hover:rotate-12 transition-transform" />
                    <Send size={20} className="hidden sm:block translate-x-0.5 translate-y-0.5 group-hover:rotate-12 transition-transform" />
                </button>
            </div>
        </form>
    );
};

export default ChatInput;