import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CLIENT_NAME } from '../config/branding';
import { ChevronLeft, Mic, MessageSquare, Sparkles } from 'lucide-react';

const Chat = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Make sure no body class lingers from a prior agent page
        document.body.classList.remove('voice-page', 'chat-only-page', 'chat-page');
    }, []);

    return (
        <div className="fixed inset-0 flex flex-col w-full bg-[#f8fafc] font-sans overflow-hidden items-center justify-center sm:relative sm:h-screen sm:p-6">

            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-sky-200/30 rounded-full blur-[80px] sm:blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[250px] sm:w-[500px] h-[250px] sm:h-[500px] bg-sky-100/40 rounded-full blur-[60px] sm:blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="flex-1 w-full max-w-3xl mx-auto z-10 flex flex-col overflow-hidden bg-white/70 backdrop-blur-2xl sm:rounded-3xl shadow-2xl border border-white/50 relative">

                <header className="flex-none h-14 sm:h-16 z-20 w-full bg-white/40 border-b border-white/50 backdrop-blur-sm px-3 sm:px-6 flex items-center">
                    <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group" onClick={() => navigate('/home')}>
                        <div className="sm:hidden mr-1">
                            <ChevronLeft size={24} className="text-gray-600" />
                        </div>
                        <div className="relative">
                            <div className="absolute -inset-0.5 bg-gradient-to-tr from-sky-300 to-sky-400 rounded-full opacity-60 blur group-hover:opacity-100 transition duration-300" />
                            <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white p-0.5 flex items-center justify-center shadow-sm">
                                <div className="w-full h-full rounded-full bg-gradient-to-br from-sky-300 to-sky-400 flex items-center justify-center text-gray-800">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="m5 10 2 1.5" /><path d="M8.5 13.5 12 16l3.5-2.5" /><path d="m19 10-2 1.5" /><path d="M12 22v-6" /><path d="M15 10a3 3 0 0 1-3 3 3 3 0 0 1-3-3" /></svg>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h1 className="font-bold text-gray-900 text-base sm:text-lg leading-tight tracking-tight group-hover:text-sky-500 transition-colors">{CLIENT_NAME} Agent</h1>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-green-600">Online</span>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center bg-slate-100/80">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-300 to-sky-400 flex items-center justify-center shadow-lg">
                        <Sparkles className="w-8 h-8 text-gray-800" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">Your Loan Assistant is Ready</h2>
                        <p className="text-sm text-gray-500 max-w-sm">Choose how you'd like to interact with our AI agent.</p>
                    </div>
                </main>

                {/* Mode selection buttons — same as old design */}
                <div className="flex-none p-3 sm:p-4 bg-white/40 border-t border-white/50 backdrop-blur-sm min-h-[90px] sm:min-h-[120px] flex flex-col justify-center">
                    <div className="flex items-center justify-center gap-2 sm:gap-4 w-full max-w-3xl mx-auto px-3 sm:px-6 h-[52px]">
                        <button
                            onClick={() => navigate('/agent/chat')}
                            className="flex-1 sm:w-[200px] sm:flex-none h-11 sm:h-[52px] flex items-center justify-center gap-2 rounded-xl font-semibold shadow-lg transition-all duration-300 bg-gradient-to-br from-sky-200 to-sky-300 text-gray-900 hover:from-sky-300 hover:to-sky-400 hover:-translate-y-0.5 text-sm sm:text-base"
                        >
                            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="whitespace-nowrap">Chat with Agent</span>
                            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 opacity-70" />
                        </button>
                        <button
                            onClick={() => navigate('/agent/voice')}
                            className="flex-1 sm:w-[200px] sm:flex-none h-11 sm:h-[52px] flex items-center justify-center gap-2 rounded-xl font-semibold shadow-lg transition-all duration-300 bg-gradient-to-br from-sky-200 to-sky-300 text-gray-900 hover:from-sky-300 hover:to-sky-400 hover:-translate-y-0.5 text-sm sm:text-base"
                        >
                            <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="whitespace-nowrap">Talk to Agent</span>
                            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 opacity-70" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;
