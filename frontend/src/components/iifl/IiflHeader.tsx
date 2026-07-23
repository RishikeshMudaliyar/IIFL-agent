import { useState } from 'react';
import { ChevronDown, Menu, Search, User, X } from 'lucide-react';
import { CLIENT_LOGO } from '../../config/branding';

interface NavItem {
    label: string;
    href: string;
    children?: { label: string; href: string }[];
}

const NAV_ITEMS: NavItem[] = [
    {
        label: 'Gold Loan',
        href: '#gold-loans',
        children: [
            { label: 'Apply For Gold Loan', href: '#gold-loans' },
            { label: 'Gold Loan Calculator', href: '#calculators' },
            { label: 'Gold Loan Interest Rates', href: '#gold-loans' },
            { label: 'Gold Rate Today', href: '#gold-loans' },
            { label: 'Gold Loan Repayment', href: '#gold-loans' },
            { label: 'Document Required', href: '#gold-loans' },
        ],
    },
    {
        label: 'Business Loan',
        href: '#business-loans',
        children: [
            { label: 'Apply For Business Loan', href: '#business-loans' },
            { label: 'Business Loan Calculator', href: '#calculators' },
            { label: 'Interest Rates and Charges', href: '#business-loans' },
            { label: 'Process & Documents Required', href: '#business-loans' },
            { label: 'Repayments', href: '#business-loans' },
        ],
    },
    { label: 'Secured Business Loan', href: '#business-loans' },
    {
        label: 'MSME',
        href: '#msme',
        children: [
            { label: 'MSME Loan', href: '#msme' },
            { label: 'MSME Knowledge Center', href: '#msme' },
            { label: 'MSME Loan Interest Rate', href: '#msme' },
        ],
    },
    {
        label: 'Others',
        href: '#others',
        children: [
            { label: 'Credit Score', href: '#others' },
            { label: 'Loan Against Securities', href: '#others' },
            { label: 'Digital Finance', href: '#others' },
            { label: 'Co-lending Partners', href: '#others' },
            { label: 'Calculators', href: '#calculators' },
        ],
    },
];

const UPPER_STRIP_ITEMS = [
    { label: 'About Us', href: '#' },
    { label: 'Investor Relations', href: '#' },
    { label: 'ESG Profile', href: '#' },
    { label: 'CSR', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Reach Us', href: '#' },
    { label: 'More', href: '#' },
];

interface IiflHeaderProps {
    onOpenAgent?: () => void;
}

const IiflHeader = ({ onOpenAgent }: IiflHeaderProps) => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    return (
        <header className="sticky top-0 z-50 w-full font-roboto shadow-sm">
            {/* Top orange accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-iifl-orange via-iifl-orange-light to-iifl-orange" />

            {/* Marquee strip */}
            <div className="hidden md:block bg-iifl-navy text-white text-[11px] tracking-wide overflow-hidden">
                <div className="whitespace-nowrap py-1 px-4 animate-[marquee_22s_linear_infinite]">
                    IIFL Finance will never request any extra fees during the loan process. Any applicable charges will be deducted directly from the Loan Account.
                </div>
            </div>

            {/* Upper utility strip */}
            <div className="hidden lg:flex items-center justify-between bg-white border-b border-gray-100 px-6 xl:px-10 py-1.5 text-xs text-gray-600">
                <nav className="flex items-center gap-5">
                    {UPPER_STRIP_ITEMS.map((item) => (
                        <a key={item.label} href={item.href} className="hover:text-iifl-orange transition-colors font-medium">
                            {item.label}
                        </a>
                    ))}
                </nav>
                <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1 text-gray-500 hover:text-iifl-orange transition-colors">
                        EN <ChevronDown size={12} />
                    </button>
                    <a href="#" className="hover:text-iifl-orange transition-colors font-medium">Download</a>
                    <button className="flex items-center gap-1.5 bg-iifl-navy text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-iifl-navy-light transition-colors">
                        <User size={13} /> My Account
                    </button>
                </div>
            </div>

            {/* Main nav */}
            <div className="bg-white px-4 sm:px-6 xl:px-10">
                <div className="flex items-center justify-between h-[64px] max-w-[1440px] mx-auto">
                    <a href="#top" className="flex items-center shrink-0">
                        <img src={CLIENT_LOGO} alt="IIFL Finance" className="h-9 sm:h-10 w-auto object-contain" />
                    </a>

                    <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
                        {NAV_ITEMS.map((item) => (
                            <div
                                key={item.label}
                                className="relative"
                                onMouseEnter={() => item.children && setOpenDropdown(item.label)}
                                onMouseLeave={() => setOpenDropdown(null)}
                            >
                                <a
                                    href={item.href}
                                    className="flex items-center gap-1 px-3 py-2 text-[13px] xl:text-sm font-semibold text-gray-700 hover:text-iifl-orange transition-colors whitespace-nowrap"
                                >
                                    {item.label}
                                    {item.children && <ChevronDown size={13} className="opacity-60" />}
                                </a>
                                {item.children && openDropdown === item.label && (
                                    <div className="absolute left-0 top-full pt-1 z-50 min-w-[240px]">
                                        <div className="bg-white rounded-lg shadow-xl border border-gray-100 py-2 overflow-hidden">
                                            {item.children.map((c) => (
                                                <a
                                                    key={c.label}
                                                    href={c.href}
                                                    className="block px-4 py-2 text-sm text-gray-600 hover:bg-iifl-cream hover:text-iifl-orange transition-colors"
                                                >
                                                    {c.label}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <button className="hidden sm:flex p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
                            <Search size={18} />
                        </button>
                        {onOpenAgent && (
                            <button
                                onClick={onOpenAgent}
                                className="hidden sm:inline-flex items-center gap-1.5 bg-iifl-orange hover:bg-iifl-orange-dark text-white px-4 py-2 rounded-full text-xs sm:text-sm font-bold shadow-sm transition-colors"
                            >
                                Chat Now
                            </button>
                        )}
                        <button
                            className="lg:hidden p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
                            onClick={() => setMobileOpen((v) => !v)}
                            aria-label="Toggle navigation"
                        >
                            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {mobileOpen && (
                <div className="lg:hidden bg-white border-t border-gray-100 px-4 py-3 max-h-[70vh] overflow-y-auto">
                    {NAV_ITEMS.map((item) => (
                        <a
                            key={item.label}
                            href={item.href}
                            className="block py-2.5 text-sm font-semibold text-gray-700 border-b border-gray-50"
                        >
                            {item.label}
                        </a>
                    ))}
                    <div className="flex gap-2 mt-3">
                        <button className="flex-1 flex items-center justify-center gap-1.5 bg-iifl-navy text-white px-3 py-2 rounded-full text-xs font-semibold">
                            <User size={13} /> My Account
                        </button>
                        {onOpenAgent && (
                            <button
                                onClick={onOpenAgent}
                                className="flex-1 bg-iifl-orange text-white px-3 py-2 rounded-full text-xs font-bold"
                            >
                                Chat Now
                            </button>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
};

export default IiflHeader;
