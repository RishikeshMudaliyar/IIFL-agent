import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CLIENT_NAME } from '../config/branding';
import { ChevronLeft, Mic, MessageSquare, Loader2 } from 'lucide-react';

const clearNurixStorage = () => {
    const wipe = (storage: Storage) => {
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key && /nurix|widget|chat-?session|conversation/i.test(key)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => storage.removeItem(k));
    };
    try { wipe(localStorage); } catch { /* ignore */ }
    try { wipe(sessionStorage); } catch { /* ignore */ }
};

const findClickable = (containerId: string): HTMLElement | null => {
    const container = document.getElementById(containerId);
    if (!container) return null;
    const direct = container.querySelector('button, [role="button"]') as HTMLElement | null;
    if (direct) return direct;
    const host = container.firstElementChild as HTMLElement | null;
    if (host?.shadowRoot) {
        const inShadow = host.shadowRoot.querySelector('button, [role="button"]') as HTMLElement | null;
        if (inShadow) return inShadow;
    }
    return null;
};

const AgentPage = () => {
    const navigate = useNavigate();
    const { mode } = useParams<{ mode: string }>();
    const isVoice = mode === 'voice';
    const containerId = isVoice ? 'nurix-voice-widget-container' : 'nurix-widget';
    const [launched, setLaunched] = useState(false);
    const attemptRef = useRef(0);

    useEffect(() => {
        clearNurixStorage();
        const className = isVoice ? 'voice-page' : 'chat-only-page';
        document.body.classList.add(className);

        // Note which elements exist BEFORE we click — anything new is widget popup
        const initialBodyChildren = new Set(Array.from(document.body.children));

        const forceFullScreen = (el: HTMLElement) => {
            const apply = (target: HTMLElement) => {
                target.style.setProperty('position', 'fixed', 'important');
                target.style.setProperty('top', '60px', 'important');
                target.style.setProperty('left', '0', 'important');
                target.style.setProperty('right', '0', 'important');
                target.style.setProperty('bottom', '0', 'important');
                target.style.setProperty('width', '100%', 'important');
                target.style.setProperty('height', 'calc(100vh - 60px)', 'important');
                target.style.setProperty('max-width', 'none', 'important');
                target.style.setProperty('max-height', 'none', 'important');
                target.style.setProperty('border-radius', '0', 'important');
                target.style.setProperty('inset', '60px 0 0 0', 'important');
            };
            apply(el);
            // Also stretch direct children
            Array.from(el.children).forEach((c) => apply(c as HTMLElement));
            // If shadow DOM, try to style internal containers
            const host = el.firstElementChild as HTMLElement | null;
            const root = host?.shadowRoot;
            if (root) {
                root.querySelectorAll('div, section, main, [class*="widget"], [class*="chat"], [class*="container"]').forEach((node) => {
                    const target = node as HTMLElement;
                    if (target.offsetWidth > 200 && target.offsetHeight > 200) apply(target);
                });
            }
        };

        // Observer: when new top-level element appears in body, treat it as the popup
        const observer = new MutationObserver(() => {
            Array.from(document.body.children).forEach((child) => {
                if (initialBodyChildren.has(child)) return;
                forceFullScreen(child as HTMLElement);
            });
            const ourContainer = document.getElementById(containerId);
            if (ourContainer) forceFullScreen(ourContainer);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Poll for the Nurix launcher button then click it
        let timer: number;
        const tryLaunch = () => {
            attemptRef.current += 1;
            const btn = findClickable(containerId);
            if (btn) {
                btn.click();
                setLaunched(true);
                // Re-apply after popup opens
                setTimeout(() => {
                    const c = document.getElementById(containerId);
                    if (c) forceFullScreen(c);
                }, 500);
                return;
            }
            if (attemptRef.current < 40) {
                timer = window.setTimeout(tryLaunch, 250);
            }
        };
        timer = window.setTimeout(tryLaunch, 600);

        return () => {
            clearTimeout(timer);
            observer.disconnect();
            document.body.classList.remove(className);
        };
    }, [isVoice, containerId]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-sky-50/30 flex flex-col font-sans">
            <header className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-gray-100 bg-white/60 backdrop-blur-sm">
                <button
                    onClick={() => navigate('/chat')}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ChevronLeft size={20} />
                    <span className="font-semibold text-sm">Back</span>
                </button>
                <div className="flex items-center gap-2">
                    {isVoice ? <Mic className="w-4 h-4 text-sky-500" /> : <MessageSquare className="w-4 h-4 text-sky-500" />}
                    <span className="font-bold text-gray-900 text-sm sm:text-base">
                        {isVoice ? `Ask ${CLIENT_NAME} Agent` : 'Chat with us'}
                    </span>
                </div>
                <span className="text-xs text-gray-400 hidden sm:inline">{CLIENT_NAME}</span>
            </header>

            <main className="flex-1 flex items-center justify-center">
                {!launched && (
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                        <p className="text-sm">Connecting to {isVoice ? 'voice' : 'chat'} agent…</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AgentPage;
