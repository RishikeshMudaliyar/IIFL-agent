import { Sparkles } from 'lucide-react';
import { CLIENT_LOGO } from '../../config/branding';

interface IiflHeaderProps {
    onOpenAgent?: () => void;
}

// Deliberately minimal header for the demo: just the client logo and a single
// "Talk to AI Agent" CTA. The real IIFL site's utility strip + mega-menus are
// intentionally stripped so the focus stays on the AI capability, not banking IA.
const IiflHeader = ({ onOpenAgent }: IiflHeaderProps) => {
    return (
        <header className="sticky top-0 z-50 w-full font-roboto shadow-sm">
            {/* Top orange accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-iifl-orange via-iifl-orange-light to-iifl-orange" />

            {/* Marquee compliance strip — kept for authenticity */}
            <div className="hidden md:block bg-iifl-navy text-white text-[11px] tracking-wide overflow-hidden">
                <div className="whitespace-nowrap py-1 px-4 animate-[marquee_22s_linear_infinite]">
                    IIFL Finance will never request any extra fees during the loan process. Any applicable charges will be deducted directly from the Loan Account.
                </div>
            </div>

            {/* Main bar: logo + single AI CTA */}
            <div className="bg-white px-4 sm:px-6 xl:px-10">
                <div className="flex items-center justify-between h-[64px] max-w-[1440px] mx-auto">
                    <a href="#top" className="flex items-center shrink-0">
                        <img src={CLIENT_LOGO} alt="IIFL Finance" className="h-9 sm:h-10 w-auto object-contain" />
                    </a>

                    {onOpenAgent && (
                        <button
                            onClick={onOpenAgent}
                            className="inline-flex items-center gap-2 bg-iifl-orange hover:bg-iifl-orange-dark text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-sm transition-colors"
                        >
                            <Sparkles size={15} />
                            Talk to AI Agent
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default IiflHeader;
