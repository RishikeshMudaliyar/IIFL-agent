import { Facebook, Twitter, Instagram, Youtube } from 'lucide-react';

const LINK_GROUPS = [
    {
        title: 'Loans',
        links: ['Gold Loan', 'Business Loan', 'Secured Business Loan', 'MSME Loan', 'Loan Against Securities'],
    },
    {
        title: 'Calculators',
        links: ['Gold Loan Calculator', 'Business Loan Calculator', 'EMI Calculator', 'GST Calculator'],
    },
    {
        title: 'Company',
        links: ['About Us', 'Investor Relations', 'ESG Profile', 'CSR', 'Careers', 'Reach Us'],
    },
    {
        title: 'Support',
        links: ['Locate Us', 'Grievance Redressal', 'Fair Practices Code', 'KYC Policy', 'Sitemap'],
    },
];

const SUBSIDIARIES = ['IIFL Capital', 'Samasta', 'IIFL Home Loans', 'Open Fintech'];

const IiflFooter = () => {
    return (
        <footer className="bg-iifl-navy text-white/80 font-roboto">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-12">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
                    {LINK_GROUPS.map((group) => (
                        <div key={group.title}>
                            <h4 className="text-white font-semibold text-sm mb-3">{group.title}</h4>
                            <ul className="space-y-2">
                                {group.links.map((link) => (
                                    <li key={link}>
                                        <a href="#" className="text-[13px] text-white/60 hover:text-iifl-orange transition-colors">
                                            {link}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="text-[11px] uppercase tracking-wide text-white/40">Our Group:</span>
                        {SUBSIDIARIES.map((s) => (
                            <span key={s} className="text-[13px] text-white/70">{s}</span>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        {[Facebook, Twitter, Instagram, Youtube].map((Icon, i) => (
                            <a
                                key={i}
                                href="#"
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-iifl-orange flex items-center justify-center transition-colors"
                                aria-label="social"
                            >
                                <Icon size={15} className="text-white" />
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-black/20 border-t border-white/10">
                <p className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-3 text-[11px] text-white/40 text-center md:text-left">
                    Copyright © 2026 IIFL Finance Limited. All rights Reserved. &nbsp;|&nbsp; Privacy Policy &nbsp;·&nbsp; Terms &amp; Conditions &nbsp;·&nbsp; Disclaimer
                </p>
            </div>
        </footer>
    );
};

export default IiflFooter;
