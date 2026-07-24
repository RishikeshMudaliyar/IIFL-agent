import { useState } from 'react';
import { Check, Phone, Sparkles } from 'lucide-react';

const HERO_IMG =
    'https://nbfciiflprodstg.blob.core.windows.net/iifl-storage/files/images/themes/custom/iifl_finance/hero-banner/tb-eleven/tbm-carousel-06-min-1200.webp';

const LOAN_TYPES = [
    { id: 'gold', label: 'Gold Loans' },
    { id: 'business', label: 'Business Loans' },
    { id: 'secured', label: 'Secured Business Loans' },
] as const;

export interface HeroLead {
    name: string;
    phone: string;
    pincode: string;
    loanType: 'gold' | 'business' | 'secured';
}

interface IiflHeroProps {
    // Single path: submit the lead form -> outbound phone call from the AI agent.
    onApply?: (lead: HeroLead) => void;
}

const IiflHero = ({ onApply }: IiflHeroProps) => {
    const [loanType, setLoanType] = useState<'gold' | 'business' | 'secured'>('gold');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [pincode, setPincode] = useState('');
    const [agreed, setAgreed] = useState(false);

    // The agent places a real outbound call to this number, so require a valid
    // 10-digit Indian mobile + a name + T&C before we let the call fire.
    const canSubmit = name.trim().length > 0 && phone.length === 10 && agreed;

    const handleApply = () => {
        if (!canSubmit) return;
        onApply?.({ name: name.trim(), phone: phone.trim(), pincode: pincode.trim(), loanType });
    };

    return (
        <section id="top" className="relative bg-iifl-navy overflow-hidden font-roboto">
            {/* Decorative glows */}
            <div className="absolute -top-24 -left-24 w-[440px] h-[440px] bg-iifl-orange/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/3 w-[360px] h-[360px] bg-iifl-blue/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pt-10 sm:pt-14 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-8 items-center min-h-[560px]">
                {/* Left: real IIFL hero copy + model image */}
                <div className="relative pb-10 lg:pb-16 self-center">
                    <p className="text-white/70 font-roboto-condensed uppercase tracking-[0.12em] text-base sm:text-lg mb-1">
                        Har Business, Ke Liye
                    </p>
                    <h1
                        className="font-black uppercase text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[0.9] mb-1 bg-clip-text text-transparent"
                        style={{ backgroundImage: 'linear-gradient(180deg, #FBE7A8 0%, #E7B84B 45%, #C68A24 100%)' }}
                    >
                        Gold Loan
                    </h1>
                    <p className="text-white font-black uppercase tracking-tight text-3xl sm:text-4xl lg:text-5xl mb-6 leading-none">
                        Hai Taiyaar!
                    </p>

                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-iifl-orange-light font-extrabold text-2xl sm:text-3xl">80 Lakh+</span>
                        <span className="text-white/90 text-base sm:text-lg">Trusted, Happy Customers#</span>
                    </div>
                    <p className="text-white/40 text-[11px] mb-6">#Customer base as on 31st December, 2025</p>

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

                    {/* Carousel dots */}
                    <div className="flex items-center gap-2 mt-10">
                        <span className="w-6 h-1.5 rounded-full bg-iifl-orange" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                    </div>
                </div>

                {/* Right: lead capture card -> Apply Now goes to the live-call page */}
                <div className="relative bg-white rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-[420px] mx-auto lg:mx-0 lg:ml-auto z-10 mb-10 lg:mb-14">
                    {/* Floating call-us icon on right edge */}
                    <div className="hidden sm:flex flex-col gap-3 absolute -right-5 top-8 z-20">
                        <a
                            href="tel:18602673000"
                            className="w-10 h-10 rounded-full bg-iifl-orange text-white flex items-center justify-center shadow-lg hover:bg-iifl-orange-dark transition-colors"
                            aria-label="Call us"
                        >
                            <Phone size={16} />
                        </a>
                    </div>

                    <h2 className="text-gray-800 font-bold text-base sm:text-lg mb-1">
                        Choose the type of loan you are looking for?
                    </h2>
                    <p className="text-[12px] text-gray-500 mb-4">
                        Enter your details and our AI agent will call you to complete the application.
                    </p>

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
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-iifl-orange focus:ring-2 focus:ring-iifl-orange/10 transition-all"
                        />
                        <input
                            type="tel"
                            placeholder="Mobile Number"
                            maxLength={10}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-iifl-orange focus:ring-2 focus:ring-iifl-orange/10 transition-all"
                        />
                        <input
                            type="tel"
                            placeholder="Enter Pincode"
                            maxLength={6}
                            value={pincode}
                            onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
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
                        onClick={handleApply}
                        disabled={!canSubmit}
                        className="w-full inline-flex items-center justify-center gap-2 bg-iifl-orange hover:bg-iifl-orange-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-full shadow-md transition-colors text-sm"
                    >
                        <Sparkles size={16} />
                        Talk to AI Agent
                    </button>
                    <p className="mt-2 text-[11px] text-gray-400 text-center">
                        Our AI agent will call {phone.length === 10 ? `+91 ${phone}` : 'your mobile number'} in a few seconds.
                    </p>
                </div>
            </div>

            {/* Model image — section-level so her straight bottom edge sits exactly
                on top of the orange T&C bar (she "stands" on it). Centred in the gap
                between the copy column and the form card. */}
            <img
                src={HERO_IMG}
                alt="IIFL Finance"
                className="hidden lg:block absolute bottom-7 left-1/2 -translate-x-1/2 w-[300px] xl:w-[360px] h-auto object-contain object-bottom drop-shadow-2xl pointer-events-none select-none z-0"
            />

            {/* Orange bottom bar — matches the main IIFL site's orange strip */}
            <div className="relative bg-iifl-orange z-20">
                <p className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-1.5 text-white/90 text-[10px]">*T&amp;C apply</p>
            </div>
        </section>
    );
};

export default IiflHero;
