import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, AlertCircle, User, Phone, Calendar, Mail, MapPin, Briefcase, IndianRupee } from 'lucide-react';
import { getApplicationById, LoanApplicationDetail } from '../lib/loanApi';

const LoanDetailsPage = () => {
    const navigate = useNavigate();
    const { applicationId } = useParams<{ applicationId: string }>();
    const [application, setApplication] = useState<LoanApplicationDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchApplication = async () => {
            if (!applicationId) {
                setError('Application ID not provided');
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError('');
            const response = await getApplicationById(applicationId);
            if (response.success && response.data) {
                setApplication(response.data);
            } else {
                setError(response.error || 'Failed to load application');
            }
            setIsLoading(false);
        };

        fetchApplication();
    }, [applicationId]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const DetailItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) => (
        <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-sky-500" />
            </div>
            <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">{label}</p>
                <p className="text-gray-800 font-medium mt-0.5">{value || '-'}</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F3F4F6] pb-20 font-sans">
            {/* Hero Header - Brand Theme */}
            <div className="bg-gradient-to-r from-sky-400 to-sky-400 relative overflow-hidden py-12 sm:py-20 pb-24 sm:pb-32">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-sky-300/30 blur-[80px] rounded-full pointer-events-none translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-sky-300/20 blur-[80px] rounded-full pointer-events-none -translate-x-1/2 translate-y-1/2" />
                <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
                    <button
                        onClick={() => navigate('/applications')}
                        className="flex items-center gap-2 text-gray-700/70 hover:text-gray-900 transition-colors mb-4 sm:mb-6"
                    >
                        <ArrowLeft size={16} className="sm:hidden" />
                        <ArrowLeft size={18} className="hidden sm:block" />
                        <span className="text-xs sm:text-sm font-medium">Back to Applications</span>
                    </button>
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/30 w-fit rounded-full text-xs font-semibold text-gray-800 mb-4 sm:mb-6 backdrop-blur-sm border border-white/40">
                            <FileText size={12} />
                            Application Details
                        </div>
                        <h1 className="text-xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-3 sm:mb-4 break-all sm:break-normal">
                            {isLoading ? 'Loading...' : (application?.application_id || 'Not Found')}
                        </h1>
                        {application && (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                                <span className="text-gray-700 text-xs sm:text-sm flex items-center gap-1">
                                    <Calendar size={12} className="sm:hidden" />
                                    <Calendar size={14} className="hidden sm:block" />
                                    Submitted on {formatDateTime(application.created_at)}
                                </span>
                            </div>
                        )}
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
                            <p className="text-gray-500 font-medium">Loading application details...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {!isLoading && error && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-16 h-16 bg-sky-50 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle size={32} className="text-sky-500" />
                            </div>
                            <p className="text-gray-700 font-semibold mb-2">Failed to load application</p>
                            <p className="text-gray-500 text-sm mb-4">{error}</p>
                            <button
                                onClick={() => navigate('/applications')}
                                className="px-6 py-2 abc-button text-gray-900 rounded-xl font-medium transition-colors"
                            >
                                Back to List
                            </button>
                        </div>
                    )}

                    {/* Application Details */}
                    {!isLoading && !error && application && (
                        <div className="p-4 sm:p-8 md:p-12 space-y-6 sm:space-y-10">

                            {/* Personal Details */}
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                                    <span className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs sm:text-sm font-extrabold">1</span>
                                    Personal Details
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                                    <DetailItem icon={User} label="Full Name" value={application.full_name} />
                                    <DetailItem icon={FileText} label="PAN Number" value={application.pan} />
                                    <DetailItem icon={Calendar} label="Date of Birth" value={formatDate(application.dob)} />
                                    <DetailItem icon={Phone} label="Phone Number" value={application.phone} />
                                    <DetailItem icon={Mail} label="Email" value={application.email} />
                                    <DetailItem icon={User} label="Gender" value={application.gender} />
                                </div>
                            </div>

                            <div className="h-px bg-gray-100 w-full" />

                            {/* Employment Details */}
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                                    <span className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs sm:text-sm font-extrabold">2</span>
                                    Employment Details
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                                    <DetailItem icon={Briefcase} label="Employment Type" value={application.employment_type} />
                                    <DetailItem icon={IndianRupee} label="Monthly Income" value={formatAmount(application.monthly_income)} />
                                </div>
                            </div>

                            <div className="h-px bg-gray-100 w-full" />

                            {/* Address Details */}
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                                    <span className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs sm:text-sm font-extrabold">3</span>
                                    Address Details
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                                    <DetailItem icon={MapPin} label="Address Line 1" value={application.address_line_1} />
                                    <DetailItem icon={MapPin} label="Address Line 2" value={application.address_line_2 || '-'} />
                                    <DetailItem icon={MapPin} label="City" value={application.city} />
                                    <DetailItem icon={MapPin} label="State" value={application.state} />
                                    <DetailItem icon={MapPin} label="Pin Code" value={application.pin_code} />
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoanDetailsPage;
