import { ArrowRight } from 'lucide-react';

const OFFERINGS = [
    {
        label: 'GOLD LOAN',
        title: 'Gold Loan',
        href: '#gold-loans',
        gradient: 'from-iifl-orange to-iifl-orange-dark',
    },
    {
        label: 'GOLD LOAN FOR MSME',
        title: 'Gold Loan for MSME',
        href: '#gold-loans-msme',
        gradient: 'from-iifl-navy to-iifl-navy-light',
    },
    {
        label: 'BUSINESS LOANS',
        title: 'Upto ₹75 Lakhs',
        href: '#business-loans',
        gradient: 'from-iifl-blue to-iifl-navy',
    },
];

const IiflOfferings = () => {
    return (
        <section className="bg-iifl-cream py-12 sm:py-16 font-roboto">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-8">
                    <span className="text-iifl-orange">Our</span> Offerings
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {OFFERINGS.map((o) => (
                        <a
                            key={o.title}
                            href={o.href}
                            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${o.gradient} text-white p-6 sm:p-7 h-40 sm:h-44 flex flex-col justify-between shadow-md hover:shadow-xl transition-shadow`}
                        >
                            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-white/80">
                                {o.label}
                            </span>
                            <div className="flex items-end justify-between">
                                <span className="text-lg sm:text-xl font-bold">{o.title}</span>
                                <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 group-hover:translate-x-1 transition-all">
                                    <ArrowRight size={16} />
                                </span>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default IiflOfferings;
