import { useState } from 'react';
import { Check, MessageCircle, Phone, Sparkles } from 'lucide-react';

const HERO_IMG =
    'https://nbfciiflprodstg.blob.core.windows.net/iifl-storage/files/images/themes/custom/iifl_finance/hero-banner/tb-eleven/tbm-carousel-06-min-1200.webp';

const LOAN_TYPES = [
    { id: 'gold', label: 'Gold Loans' },
    { id: 'business', label: 'Business Loans' },
    { id: 'secured', label: 'Secured Business Loans' },
];

interface IiflHeroProps {
    onOpenAgent?: () => void;
}

const IiflHero = ({ onOpenAgent }: IiflHeroProps) => {
    const [loanType, setLoanType] = useState('gold');
    const [agreed, setAgreed] = useState(false);

    return (
        <section id="top" className="relative bg-iifl-navy overflow-hidden font-roboto">
            {/* Decorative glows */}
            <div className="absolute -top-24 -left-24 w-[420px] h-[420px] bg-iifl-orange/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[360px] h-[360px] bg-iifl-blue/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-10 sm:py-14 lg:py-16 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-8 items-center">
                {/* Left: copy + model image */}
                <div className="relative">
                    <p className="text-white/70 font-roboto-condensed uppercase tracking-wide text-sm sm:text-base mb-1">
                        Har Business, Ke Liye
                    </p>
                    <h1 className="text-white font-black uppercase text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-none mb-1">
                        Gold Loan
                    </h1>
                    <p className="text-white/70 font-roboto-condensed uppercase tracking-wide text-sm sm:text-base mb-6">
                        Hai Taiyaar!
                    </p>

                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-iifl-orange-light font-extrabold text-2xl sm:text-3xl">80 Lakh+</span>
                        <span className="text-white/90 text-base sm:text-lg">Trusted, Happy Customers#</span>
                    </div>
                    <p className="text-white/40 text-[11px] mb-7">#Customer base as on 31st December, 2025</p>

                    <div className="flex flex-wrap items-center gap-6 mb-8">
                        <div className="flex items-center gap-2 text-white/90 text-sm">
                            <Check size={16} className="text-iifl-orange-light" />
                            Attractive Interest Rate*
                        </div>
                        <div className="flex items-center gap-2 text-white/90 text-sm">
                            <Check size={16} className="text-iifl-orange-light" />
                            No Hidden Charges*
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <a
                            href="#refer"
                            className="inline-flex items-center gap-2 bg-iifl-orange hover:bg-iifl-orange-dark text-white font-bold px-7 py-3.5 rounded-full shadow-lg shadow-black/20 transition-colors text-sm sm:text-base"
                        >
                            Refer Now
                        </a>
                        {onOpenAgent && (
                            <button
                                onClick={onOpenAgent}
                                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold px-6 py-3.5 rounded-full transition-colors text-sm sm:text-base backdrop-blur-sm"
                            >
                                <Sparkles size={16} />
                                Talk to AI Agent
                            </button>
                        )}
                    </div>

                    {/* Carousel dots */}
                    <div className="flex items-center gap-2 mt-10">
                        <span className="w-6 h-1.5 rounded-full bg-iifl-orange" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                    </div>

                    {/* Model image, mobile-hidden to keep layout tight on desktop demo */}
                    <img
                        src={HERO_IMG}
                        alt="IIFL Finance Gold Loan"
                        className="hidden xl:block absolute -bottom-16 right-[-40px] w-[220px] xl:w-[260px] h-auto object-contain drop-shadow-2xl pointer-events-none select-none"
                    />
                </div>

                {/* Right: lead capture card */}
                <div className="relative bg-white rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-[420px] mx-auto lg:mx-0 lg:ml-auto">
                    {/* Floating action icons on right edge */}
                    <div className="hidden sm:flex flex-col gap-3 absolute -right-5 top-8">
                        <a
                            href="tel:18602673000"
                            className="w-10 h-10 rounded-full bg-iifl-orange text-white flex items-center justify-center shadow-lg hover:bg-iifl-orange-dark transition-colors"
                            aria-label="Call us"
                        >
                            <Phone size={16} />
                        </a>
                        {onOpenAgent && (
                            <button
                                onClick={onOpenAgent}
                                className="w-10 h-10 rounded-full bg-iifl-navy text-white flex items-center justify-center shadow-lg hover:bg-iifl-navy-light transition-colors"
                                aria-label="Chat with agent"
                            >
                                <MessageCircle size={16} />
                            </button>
                        )}
                    </div>

                    <h2 className="text-gray-800 font-bold text-base sm:text-lg mb-4">
                        Choose the type of loan you are looking for?
                    </h2>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {LOAN_TYPES.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setLoanType(t.id)}
                                className={`relative rounded-lg border-2 px-2 py-3 text-[11px] sm:text-xs font-semibold text-center transition-colors ${
                                    loanType === t.id
                                        ? 'border-iifl-orange bg-iifl-cream text-iifl-orange-dark'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}
                            >
                                {loanType === t.id && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-iifl-orange text-white flex items-center justify-center">
                                        <Check size={10} />
                                    </span>
                                )}
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-3 mb-4">
                        <input
                            type="text"
                            placeholder="Full Name"
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-iifl-orange focus:ring-2 focus:ring-iifl-orange/10 transition-all"
                        />
                        <input
                            type="tel"
                            placeholder="Mobile Number"
                            maxLength={10}
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-iifl-orange focus:ring-2 focus:ring-iifl-orange/10 transition-all"
                        />
                        <input
                            type="tel"
                            placeholder="Enter Pincode"
                            maxLength={6}
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-iifl-orange focus:ring-2 focus:ring-iifl-orange/10 transition-all"
                        />
                    </div>

                    <label className="flex items-start gap-2 mb-4 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-iifl-orange focus:ring-iifl-orange accent-iifl-orange"
                        />
                        <span className="text-[11px] text-gray-500 leading-relaxed">
                            I accept the <span className="text-iifl-blue font-medium">Terms and Conditions</span> &amp;{' '}
                            <span className="text-iifl-blue font-medium">Privacy Policy</span>
                        </span>
                    </label>

                    <button
                        type="button"
                        className="w-full bg-iifl-orange hover:bg-iifl-orange-dark text-white font-bold py-3.5 rounded-full shadow-md transition-colors text-sm"
                    >
                        Apply Now
                    </button>
                </div>
            </div>

            <div className="relative bg-black/10 border-t border-white/10">
                <p className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-1.5 text-white/40 text-[10px]">*T&amp;C apply</p>
            </div>
        </section>
    );
};

export default IiflHero;
