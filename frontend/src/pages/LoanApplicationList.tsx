import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { getApplications, LoanApplicationItem } from '../lib/loanApi';

const LoanApplicationList = () => {
    const navigate = useNavigate();
    const [applications, setApplications] = useState<LoanApplicationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchApplications = async () => {
        setIsLoading(true);
        setError('');
        const response = await getApplications();
        if (response.success && response.data) {
            setApplications(response.data);
        } else {
            setError(response.error || 'Failed to load applications');
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchApplications();
    }, []);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div className="min-h-screen bg-[#F3F4F6] pb-20 font-sans">
            {/* Hero Header - ABC Theme */}
            <div className="bg-gradient-to-r from-sky-400 to-sky-400 relative overflow-hidden py-12 sm:py-20 pb-24 sm:pb-32">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-sky-300/30 blur-[80px] rounded-full pointer-events-none translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-sky-300/20 blur-[80px] rounded-full pointer-events-none -translate-x-1/2 translate-y-1/2" />
                <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
                    <button
                        onClick={() => navigate('/home')}
                        className="flex items-center gap-2 text-gray-700/70 hover:text-gray-900 transition-colors mb-4 sm:mb-6"
                    >
                        <ArrowLeft size={16} className="sm:hidden" />
                        <ArrowLeft size={18} className="hidden sm:block" />
                        <span className="text-xs sm:text-sm font-medium">Back to Home</span>
                    </button>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/30 w-fit rounded-full text-xs font-semibold text-gray-800 mb-4 sm:mb-6 backdrop-blur-sm border border-white/40">
                                <FileText size={12} />
                                Application Dashboard
                            </div>
                            <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-3 sm:mb-6">Loan Applications</h1>
                            <p className="text-gray-700 text-sm sm:text-lg max-w-2xl leading-relaxed">View and track all submitted loan applications</p>
                        </div>
                        <button
                            onClick={fetchApplications}
                            disabled={isLoading}
                            className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/30 hover:bg-white/50 text-gray-800 rounded-xl transition-all border border-white/40"
                        >
                            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-3 sm:px-6 -mt-16 sm:-mt-20 relative z-10">
                <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">

                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 size={40} className="text-sky-500 animate-spin mb-4" />
                            <p className="text-gray-500 font-medium">Loading applications...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {!isLoading && error && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-16 h-16 bg-sky-50 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle size={32} className="text-sky-500" />
                            </div>
                            <p className="text-gray-700 font-semibold mb-2">Failed to load applications</p>
                            <p className="text-gray-500 text-sm mb-4">{error}</p>
                            <button
                                onClick={fetchApplications}
                                className="px-6 py-2 abc-button text-white rounded-xl font-medium transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoading && !error && applications.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <FileText size={32} className="text-gray-400" />
                            </div>
                            <p className="text-gray-700 font-semibold mb-2">No applications yet</p>
                            <p className="text-gray-500 text-sm mb-4">Submit your first loan application to get started</p>
                            <button
                                onClick={() => navigate('/loan-application')}
                                className="px-6 py-2 abc-button text-white rounded-xl font-medium transition-colors"
                            >
                                Apply Now
                            </button>
                        </div>
                    )}

                    {/* Applications List */}
                    {!isLoading && !error && applications.length > 0 && (
                        <div className="divide-y divide-gray-100">
                            {/* Table Header */}
                            <div className="hidden md:grid md:grid-cols-12 gap-2 px-8 py-4 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <div className="col-span-3 text-center">Application ID</div>
                                <div className="col-span-4 text-center">Applicant</div>
                                <div className="col-span-4 text-center">Phone</div>
                                <div className="col-span-1 text-center"></div>
                            </div>

                            {applications.map((app) => (
                                <div
                                    key={app.id}
                                    onClick={() => navigate(`/application/${app.application_id}`)}
                                    className="px-6 md:px-8 py-4 hover:bg-sky-50/50 transition-colors cursor-pointer group"
                                >
                                    {/* Mobile Layout */}
                                    <div className="md:hidden flex items-center justify-between">
                                        <div>
                                            <span className="font-mono font-bold text-sky-600 text-sm">{app.application_id}</span>
                                            <p className="font-semibold text-gray-800 mt-1">{app.full_name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-gray-400">{app.phone}</span>
                                                <span className="text-xs text-gray-300">•</span>
                                                <span className="text-xs text-gray-400">{formatDate(app.created_at)}</span>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-300" />
                                    </div>

                                    {/* Desktop Layout */}
                                    <div className="hidden md:grid md:grid-cols-12 gap-2 items-center">
                                        {/* Application ID */}
                                        <div className="col-span-3 text-center">
                                            <span className="font-mono font-bold text-sky-600 text-sm">{app.application_id}</span>
                                        </div>

                                        {/* Applicant */}
                                        <div className="col-span-4 text-center">
                                            <p className="font-semibold text-gray-800">{app.full_name}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{formatDate(app.created_at)}</p>
                                        </div>

                                        {/* Phone */}
                                        <div className="col-span-4 text-center">
                                            <p className="font-medium text-gray-800">{app.phone}</p>
                                        </div>

                                        {/* Arrow */}
                                        <div className="col-span-1 text-center">
                                            <ChevronRight size={18} className="text-gray-300 group-hover:text-sky-600 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Summary Footer */}
                {!isLoading && !error && applications.length > 0 && (
                    <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
                        <span>Showing {applications.length} application(s)</span>
                        <button
                            onClick={() => navigate('/loan-application')}
                            className="text-sky-600 font-semibold hover:text-sky-700 transition-colors"
                        >
                            + New Application
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoanApplicationList;
