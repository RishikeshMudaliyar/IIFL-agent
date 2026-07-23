import { useState, useRef, useEffect, ChangeEvent, Dispatch, SetStateAction } from 'react';
import { CLIENT_NAME, CLIENT_LOGO } from '../config/branding';
import { ChevronLeft, Check, AlertCircle, HelpCircle, ChevronRight, Shield, Pencil, Eye, EyeOff, Calendar, X, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { sendOtp, createApplication } from '../lib/loanApi';

// Hand emoji is now inlined in HeroSection\r\n
// Lender logos
const LenderLogo = ({ name }: { name: string }) => {

    const logos: Record<string, JSX.Element> = {
        'L&T Finance': (
            <div className="w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center text-white font-bold text-sm">L&T</div>
        ),
        'Poonawala Fincorp': (
            <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold text-sm">P</div>
        ),
        'KreditBee': (
            <div className="w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center text-black font-bold text-sm">K</div>
        ),
    };
    return logos[name] || <div className="w-10 h-10 bg-gray-400 rounded-full" />;
};

interface LoanOffer {
    lender: string;
    amount: string;
    emi: string;
    tenure: string;
    apr: string;
}

interface FormData {
    phone: string;
    termsAccepted: boolean;
    otp: string[];
    pan: string;
    fullName: string;
    consent1: boolean;
    consent2: boolean;
    email: string;
    dob: string;
    gender: string;
    employmentType: string;
    monthlyIncome: string;
    pincode: string;
    building: string;
    road: string;
    city: string;
    state: string;
}

// Reusable Stylish Eligibility Section Component
const EligibilitySection = () => (
    <div className="mt-6 pt-6 border-t border-gray-100">
        <h3 className="font-bold text-gray-800 text-base lg:text-lg text-center mb-4">Loan Eligibility</h3>
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-3 group">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                        <Check size={14} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-800">Age Requirement</span>
                        <p className="text-xs text-gray-500">23 to 60 years</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 group">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                        <Check size={14} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-800">Minimum Income</span>
                        <p className="text-xs text-gray-500">₹25,000 per month</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 group">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                        <Check size={14} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-800">Residency</span>
                        <p className="text-xs text-gray-500">Resident of India</p>
                    </div>
                </div>
            </div>
        </div>
        <button className="text-gray-500 text-xs flex items-center justify-center gap-1 mt-3 mx-auto hover:text-abc-red transition-colors" id="view-rates-btn">
            View Rates & Charges <ChevronRight size={14} />
        </button>
    </div>
);

// Hero Section (Steps 1-3)
// Hero Section (Steps 1-3)
const HeroSection = () => (
    <div className="text-gray-900 px-6 pb-4 pt-0 lg:p-6 lg:pb-4 relative overflow-hidden lg:rounded-none lg:h-full lg:flex lg:flex-col lg:justify-center lg:px-20 lg:py-12 h-full overflow-x-hidden">
        {/* Content wrapper for better centering on desktop */}
        <div className="lg:max-w-xl lg:mx-auto w-full relative z-10 flex flex-col gap-6 lg:gap-10">

            {/* Top Text Group */}
            <div className="flex flex-col gap-4 lg:gap-6 relative z-20">
                {/* Loan Header */}
                <div className="flex items-center gap-3 mt-0 lg:mt-0">
                    <span className="text-lg lg:text-xl font-bold tracking-wide font-sans">Loan</span>
                    <div className="w-6 h-6 lg:w-8 lg:h-8 bg-white/30 hover:bg-white/50 transition-colors backdrop-blur-md rounded-full flex items-center justify-center cursor-pointer" id="hero-help-icon">
                        <HelpCircle size={14} className="lg:w-5 lg:h-5" />
                    </div>
                </div>

                {/* Main headline */}
                <div className="relative pr-32 lg:pr-0 flex flex-col gap-1 lg:gap-2">
                    <h1 className="text-2xl lg:text-5xl font-extrabold leading-[1.15] tracking-tight text-gray-900">
                        Get instant loans from
                    </h1>
                    <h2 className="text-3xl lg:text-6xl font-black tracking-tight">
                        <span className="text-sky-900 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">₹15 Lakhs</span>
                        <span className="text-gray-900"> in </span>
                        <span className="text-gray-900">Minutes!</span>
                    </h2>
                    <p className="text-sm opacity-90 lg:text-lg lg:font-medium lg:opacity-85 max-w-[85%] leading-relaxed mt-1">
                        Access a wide variety of loan offers across multiple Banks & NBFCs
                    </p>

                    {/* Decorative Image - Hand with coins */}
                    <div className="absolute right-[-30px] top-[-10px] w-44 h-44 lg:right-[-120px] lg:top-1/2 lg:-translate-y-1/2 lg:w-64 lg:h-64 pointer-events-none z-0">
                        <img
                            src="/hand.png"
                            alt="Hand holding coins"
                            className="w-full h-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)]"
                        />
                    </div>
                </div>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-3 gap-2 lg:gap-6 bg-white/30 backdrop-blur-lg border border-white/50 rounded-3xl p-3 lg:p-8 shadow-xl relative overflow-hidden z-10">
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-200%] animate-[shimmer_3s_infinite]" />

                {/* Glow effect */}
                <div className="absolute -top-10 -left-10 w-32 h-32 bg-sky-400/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-sky-400/20 rounded-full blur-3xl" />

                <div className="flex flex-col items-center text-center gap-2 lg:gap-4 relative z-10 group">
                    <div className="w-12 h-12 lg:w-16 lg:h-16 bg-white/40 rounded-2xl flex items-center justify-center shadow-lg border border-white/60 group-hover:scale-110 group-hover:shadow-xl transition-all duration-300">
                        <svg className="w-6 h-6 lg:w-8 lg:h-8 text-sky-900 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                            <rect x="9" y="3" width="6" height="4" rx="2" />
                            <path d="M9 14l2 2 4-4" />
                        </svg>
                    </div>
                    <div>
                        <span className="block text-[10px] lg:text-sm font-medium text-sky-900/80">Get offer in</span>
                        <span className="block text-sm lg:text-xl font-bold text-gray-900 drop-shadow-sm">3 Steps</span>
                    </div>
                </div>

                <div className="flex flex-col items-center text-center gap-2 lg:gap-4 relative z-10 group">
                    <div className="w-12 h-12 lg:w-16 lg:h-16 bg-white/40 rounded-2xl flex items-center justify-center shadow-lg border border-white/60 group-hover:scale-110 group-hover:shadow-xl transition-all duration-300">
                        <svg className="w-6 h-6 lg:w-8 lg:h-8 text-sky-900 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                    </div>
                    <div>
                        <span className="block text-[10px] lg:text-sm font-medium text-sky-900/80">Instant Digital</span>
                        <span className="block text-sm lg:text-xl font-bold text-gray-900 drop-shadow-sm">Sanction</span>
                    </div>
                </div>

                <div className="flex flex-col items-center text-center gap-2 lg:gap-4 relative z-10 group">
                    <div className="w-12 h-12 lg:w-16 lg:h-16 bg-white/40 rounded-2xl flex items-center justify-center shadow-lg border border-white/60 group-hover:scale-110 group-hover:shadow-xl transition-all duration-300">
                        <svg className="w-6 h-6 lg:w-8 lg:h-8 text-sky-900 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14,2 14,8 20,8" />
                            <line x1="12" y1="18" x2="12" y2="12" />
                            <line x1="9" y1="15" x2="15" y2="15" />
                        </svg>
                    </div>
                    <div>
                        <span className="block text-[10px] lg:text-sm font-medium text-sky-900/80">No Paperwork</span>
                        <span className="block text-sm lg:text-xl font-bold text-gray-900 drop-shadow-sm">Required</span>
                    </div>
                </div>
            </div>

            {/* Social proof */}
            <div className="text-center">
                <p className="inline-flex items-center gap-2 text-xs lg:text-lg font-medium bg-white/30 px-4 py-2 rounded-full border border-white/50 backdrop-blur-sm">
                    <span className="text-sky-800 text-sm lg:text-lg">✦</span>
                    <span>1 Lakh+ people got a loan in just a few clicks</span>
                    <span className="text-sky-800 text-sm lg:text-lg">✦</span>
                </p>
            </div>
        </div>

        {/* Background Decorative - Subtle glow */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-sky-400/15 blur-[80px] rounded-full pointer-events-none translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-sky-600/20 blur-[80px] rounded-full pointer-events-none -translate-x-1/2 translate-y-1/2" />
    </div>
);


// Indian States List
const INDIAN_STATES = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam",
    "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
    "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
    "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

// Custom State Dropdown Component
const StateDropdown = ({
    value,
    onChange,
    onBlur,
    error
}: {
    value: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    error: boolean;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click - only trigger onBlur if dropdown was open (user interacted)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                if (isOpen) {
                    setIsOpen(false);
                    onBlur();
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onBlur, isOpen]);

    const handleSelect = (state: string) => {
        onChange(state);
        setIsOpen(false);
    };

    return (
        <div ref={dropdownRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-4 py-3 bg-gray-100 rounded-lg border ${error ? 'border-red-500' : 'border-transparent'} focus:border-abc-red focus:bg-white focus:outline-none transition-all text-left flex items-center justify-between`}
                id="state-input"
            >
                <span className={value ? 'text-gray-800' : 'text-gray-400'}>
                    {value || 'Select State'}
                </span>
                <ChevronDown size={18} className={`text-abc-red transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto" id="state-dropdown-list">
                    {INDIAN_STATES.map((state) => (
                        <button
                            key={state}
                            type="button"
                            onClick={() => handleSelect(state)}
                            className={`w-full px-4 py-3 text-left hover:bg-sky-50 hover:text-abc-red transition-colors ${value === state ? 'bg-sky-100 text-abc-red font-semibold' : 'text-gray-700'}`}
                            id={`state-option-${state.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                            {state}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// Step 1: Mobile Number Entry
const Step1 = ({
    formData,
    handleChange,
    handleApplyNow,
    errors,
    touched,
    handleBlur,
    isLoading,
    apiError
}: {
    formData: FormData;
    handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
    handleApplyNow: () => void;
    errors: Record<string, string>;
    touched: Record<string, boolean>;
    handleBlur: (name: string) => void;
    isLoading: boolean;
    apiError: string;
}) => (
    <div className="animate-slideUp h-full flex flex-col justify-center bg-white lg:px-12 lg:py-8">
        <div className="p-6 space-y-4 lg:p-0 lg:max-w-lg lg:mx-auto lg:w-full lg:space-y-5">
            {/* Mobile Input */}
            <div>
                <label className="text-gray-600 text-base font-medium mb-3 block">Enter mobile number</label>
                <div className={`flex items-center bg-slate-50 rounded-xl border ${touched.phone && errors.phone ? 'border-red-500' : 'border-gray-200'} focus-within:border-abc-red focus-within:ring-4 focus-within:ring-sky-50 focus-within:bg-white transition-all duration-300`}>
                    <span className="pl-5 pr-3 text-xl font-bold text-gray-800">+91</span>
                    <div className="h-8 w-px bg-gray-300 mx-2"></div>
                    <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        onBlur={() => handleBlur('phone')}
                        maxLength={10}
                        className="flex-1 px-3 py-5 bg-transparent text-xl font-medium text-gray-800 focus:outline-none placeholder:text-gray-400"
                        placeholder="Enter mobile number"
                        id="mobile-input"
                        autoComplete="off"
                    />
                </div>
                {touched.phone && errors.phone && (
                    <p className="text-red-500 text-xs mt-2 ml-1 flex items-center gap-1" id="phone-error">
                        <AlertCircle size={12} />
                        {errors.phone}
                    </p>
                )}
                {!(touched.phone && errors.phone) && (
                    <p className="text-gray-500 text-xs mt-3 ml-1 flex items-center justify-center gap-1">
                        <Shield size={12} className="text-green-600" />
                        OTP will be sent to your mobile number for verification
                    </p>
                )}
            </div>

            {/* Terms Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer" id="terms-checkbox-label">
                <input
                    type="checkbox"
                    name="termsAccepted"
                    checked={formData.termsAccepted}
                    onChange={handleChange}
                    className="abc-checkbox mt-0.5"
                    id="terms-checkbox"
                />
                <span className="text-sm text-gray-600">
                    I agree with <span className="text-sky-600 font-medium">Terms and Conditions</span> and <span className="text-sky-600 font-medium">Privacy Policy</span>
                </span>
            </label>

            {/* Apply Now Button */}
            <div>
                <button
                    onClick={handleApplyNow}
                    disabled={formData.phone.length !== 10 || !formData.termsAccepted || isLoading}
                    className="w-full py-4 rounded-full abc-button text-gray-900 font-bold text-xl shadow-lg hover:shadow-xl hover:shadow-sky-200 transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                    id="apply-now-btn"
                >
                    {isLoading ? 'Sending OTP...' : 'Apply Now'}
                </button>
                {apiError && (
                    <p className="text-red-500 text-sm mt-2 text-center flex items-center justify-center gap-1" id="api-error-step1">
                        <AlertCircle size={14} />
                        {apiError}
                    </p>
                )}
            </div>

            {/* Eligibility Info - Reusable Component */}
            <EligibilitySection />
        </div>
    </div>
);

// Step 2: OTP Verification
const Step2 = ({
    formData,
    setFormData,
    setOtpError,
    setOtpLengthError,
    handleVerifyOtp,
    handleResendOtp,
    otpTimer,
    otpError,
    otpLengthError,
    resendOtpError,
    otpRefs,
    handleEditPhone,
    isLoading
}: {
    formData: FormData;
    setFormData: Dispatch<SetStateAction<FormData>>;
    setOtpError: Dispatch<SetStateAction<boolean>>;
    setOtpLengthError: Dispatch<SetStateAction<boolean>>;
    handleVerifyOtp: () => void;
    handleResendOtp: () => void;
    otpTimer: number;
    otpError: boolean;
    otpLengthError: boolean;
    resendOtpError: string;
    otpRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
    handleEditPhone: () => void;
    isLoading: boolean;
}) => (
    <div className="animate-slideUp h-full flex flex-col justify-center bg-white lg:px-12 lg:py-8">
        <div className="p-6 space-y-4 lg:p-0 lg:max-w-lg lg:mx-auto lg:w-full lg:space-y-4">
            {/* Header for OTP Step */}
            <div>
                <label className="text-gray-600 text-base font-medium mb-2 block">Verify Mobile Number</label>
                <p className="text-gray-500 text-sm mb-2">
                    OTP sent to <span className="font-semibold text-gray-800">+91 {formData.phone}</span>
                    <button
                        onClick={handleEditPhone}
                        className="text-abc-red font-medium ml-2 hover:underline text-xs"
                        id="edit-phone-btn"
                    >
                        Edit
                    </button>
                </p>
            </div>

            {/* OTP Input - Single input with visual boxes */}
            <div className="relative py-1" id="otp-container">
                {/* Visual boxes */}
                <div
                    className="flex gap-2 lg:gap-3 justify-between lg:justify-start relative z-10 cursor-text"
                    onClick={() => otpRefs.current[0]?.focus()}
                >
                    {formData.otp.map((digit, index) => {
                        const isActive = index === formData.otp.filter(d => d).length;
                        const hasError = otpError || otpLengthError;

                        return (
                            <div
                                key={index}
                                className={`w-11 h-12 lg:w-14 lg:h-16 text-center text-xl lg:text-2xl font-bold border-2 rounded-xl flex items-center justify-center transition-all duration-200 ${hasError
                                    ? 'border-red-500 bg-red-50 text-red-600'
                                    : isActive
                                        ? 'border-abc-red bg-white ring-4 ring-sky-50 text-gray-800 scale-105'
                                        : 'border-slate-200 bg-slate-50 text-gray-800 hover:border-abc-red hover:shadow-md hover:shadow-red-50'
                                    }`}
                            >
                                {digit}
                            </div>
                        );
                    })}
                </div>

                {/* Hidden single input that handles all typing */}
                <input
                    ref={el => { if (el) otpRefs.current[0] = el; }}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={formData.otp.join('')}
                    onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        const newOtp = value.split('');
                        while (newOtp.length < 6) newOtp.push('');
                        setFormData(prev => ({ ...prev, otp: newOtp }));
                        setOtpError(false);
                        setOtpLengthError(false);
                    }}
                    onBlur={() => {
                        const otpValue = formData.otp.join('');
                        if (otpValue.length > 0 && otpValue.length < 6) {
                            setOtpLengthError(true);
                        } else {
                            setOtpLengthError(false);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Backspace' && formData.otp.join('').length === 0) {
                            e.preventDefault();
                        }
                    }}
                    onPaste={(e) => {
                        e.preventDefault();
                        const pastedData = e.clipboardData.getData('text').trim();
                        const digits = pastedData.replace(/\D/g, '').slice(0, 6);
                        const newOtp = digits.split('');
                        while (newOtp.length < 6) newOtp.push('');
                        setFormData(prev => ({ ...prev, otp: newOtp }));
                        setOtpError(false);
                        setOtpLengthError(false);
                    }}
                    autoComplete="one-time-code"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    id="otp-input-hidden"
                    autoFocus
                />
            </div>

            {/* OTP Error */}
            {(otpError || otpLengthError) && (
                <div className="flex items-center gap-2 text-red-500 text-xs mt-1" id="otp-error">
                    <AlertCircle size={14} />
                    <span>Incorrect OTP. Please try again.</span>
                </div>
            )}

            {/* Resend Timer */}
            <div className="text-left mt-1">
                <p className="text-gray-500 text-xs">
                    Didn't receive code?{' '}
                    {otpTimer > 0 ? (
                        <span className="text-gray-400 font-medium">
                            Resend in {Math.floor(otpTimer / 60).toString().padStart(2, '0')}:{(otpTimer % 60).toString().padStart(2, '0')}s
                        </span>
                    ) : (
                        <button onClick={handleResendOtp} className="text-abc-red font-bold hover:underline" id="resend-otp-btn">Resend OTP</button>
                    )}
                </p>
                {resendOtpError && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1" id="api-error-resend-otp">
                        <AlertCircle size={12} />
                        {resendOtpError}
                    </p>
                )}
            </div>

            {/* Continue Button */}
            <button
                onClick={handleVerifyOtp}
                disabled={formData.otp.some(d => !d) || isLoading}
                className="w-full py-4 rounded-full abc-button text-gray-900 font-bold text-xl shadow-lg hover:shadow-xl hover:shadow-sky-200 transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none mt-2"
                id="continue-otp-btn"
            >
                {isLoading ? 'Verifying...' : 'Verify & Continue'}
            </button>

            {/* Security Badge */}
            <div className="flex items-center justify-center gap-2 text-gray-500 text-xs mt-3">
                <Shield size={12} className="text-green-600" />
                <span className="font-medium tracking-wide">YOUR DATA IS 100% SECURE</span>
            </div>

            {/* Eligibility Info - Same as Step 1 */}
            <EligibilitySection />
        </div>
    </div>
);

// Step 3: PAN & Consent
const Step3 = ({
    formData,
    handleChange,
    setFormData,
    handleContinueStep3,
    errors,
    touched,
    handleBlur
}: {
    formData: FormData;
    handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
    setFormData: Dispatch<SetStateAction<FormData>>;
    handleContinueStep3: () => void;
    errors: Record<string, string>;
    touched: Record<string, boolean>;
    handleBlur: (name: string) => void;
}) => {
    const [showPan, setShowPan] = useState(true);
    const [editingPan, setEditingPan] = useState(true);
    const [editingName, setEditingName] = useState(true);

    const maskPan = (pan: string) => {
        return '*'.repeat(pan.length);
    };

    return (
        <div className="animate-slideUp h-full flex flex-col justify-center bg-white lg:px-12 lg:py-8">

            <div className="p-6 space-y-4 lg:p-0 lg:max-w-lg lg:mx-auto lg:w-full lg:space-y-4">
                <h3 className="font-bold text-gray-800 text-xl lg:text-2xl mb-6">Confirm your fetched details</h3>

                <div className="grid grid-cols-1 gap-4">
                    {/* PAN Input */}
                    <div>
                        <label className="text-gray-500 text-sm mb-1 block">PAN</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="pan"
                                value={formData.pan ? (showPan ? formData.pan : maskPan(formData.pan)) : ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                                onBlur={() => handleBlur('pan')}
                                maxLength={10}
                                className={`abc-input pr-20 ${touched.pan && errors.pan ? 'border-red-500' : ''} ${(!editingPan || !showPan) ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                                placeholder="Enter PAN number"
                                id="pan-input"
                                readOnly={!editingPan || !showPan}
                                style={{ textTransform: formData.pan ? 'uppercase' : 'none' }}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditingPan(!editingPan)}
                                    className={`transition-colors ${editingPan ? 'text-abc-red hover:text-sky-700' : 'text-gray-400 hover:text-gray-600'}`}
                                    id="edit-pan-btn"
                                >
                                    <Pencil size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowPan(!showPan)}
                                    className="text-abc-red hover:text-sky-700 transition-colors"
                                    id="toggle-pan-visibility-btn"
                                >
                                    {showPan ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>
                            </div>
                        </div>
                        {touched.pan && errors.pan && (
                            <p className="text-red-500 text-xs mt-1 flex items-center gap-1" id="pan-error">
                                <AlertCircle size={12} />
                                {errors.pan}
                            </p>
                        )}
                    </div>

                    {/* Full Name */}
                    <div>
                        <label className="text-gray-500 text-sm mb-1 block">Full name as per PAN</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                onBlur={() => handleBlur('fullName')}
                                className={`abc-input pr-12 ${touched.fullName && errors.fullName ? 'border-red-500' : ''} ${!editingName ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                                placeholder="Enter your full name"
                                id="full-name-input"
                                readOnly={!editingName}
                            />
                            <button
                                type="button"
                                onClick={() => setEditingName(!editingName)}
                                className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${editingName ? 'text-abc-red hover:text-sky-700' : 'text-gray-400 hover:text-gray-600'}`}
                                id="edit-name-btn"
                            >
                                <Pencil size={18} />
                            </button>
                        </div>
                        {touched.fullName && errors.fullName && (
                            <p className="text-red-500 text-xs mt-1 flex items-center gap-1" id="fullname-error">
                                <AlertCircle size={12} />
                                {errors.fullName}
                            </p>
                        )}
                    </div>
                </div>

                {/* Consent 1 */}
                <label className="flex items-start gap-3 cursor-pointer" id="consent1-label">
                    <input
                        type="checkbox"
                        name="consent1"
                        checked={formData.consent1}
                        onChange={handleChange}
                        className="abc-checkbox mt-0.5"
                        style={{ transform: 'scale(1.75)' }}
                        id="consent1-checkbox"
                    />
                    <span className="text-sm text-gray-600 leading-relaxed">
                        I agree to the Terms and Conditions and Privacy Policy of {CLIENT_NAME}. I authorize {CLIENT_NAME} and Lenders/LSP as mentioned in Our List of Lending partners as my authorized representative to access my credit report and there by agree to the Terms and Conditions and Privacy Policy of Lenders/LSP as well.
                    </span>
                </label>

                {/* Consent 2 */}
                <label className="flex items-start gap-3 cursor-pointer" id="consent2-label">
                    <input
                        type="checkbox"
                        name="consent2"
                        checked={formData.consent2}
                        onChange={handleChange}
                        className="abc-checkbox mt-0.5"
                        style={{ transform: 'scale(1.75)' }}
                        id="consent2-checkbox"
                    />
                    <span className="text-sm text-gray-600 leading-relaxed">
                        I hereby confirm that the annual income of my household exceeds INR 3,00,000 and acknowledge that the Lenders/LSPs identified herein do not extend microfinance loans, in accordance with applicable regulatory norms.
                    </span>
                </label>

                {/* Continue Button */}
                <button
                    onClick={handleContinueStep3}
                    disabled={!formData.pan || !formData.fullName || !formData.consent1 || !formData.consent2}
                    className="w-full py-4 rounded-full abc-button text-gray-900 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                    id="continue-step3-btn"
                >
                    Continue
                </button>
            </div>
        </div>

    );
};

// Step 4: Additional Details
const Step4 = ({
    formData,
    handleChange,
    setFormData,
    handleGetLoanOffer,
    isLoading,
    setCurrentStep,
    errors,
    touched,
    handleBlur,
    apiError,
    setTouched,
    validateField
}: {
    formData: FormData;
    handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
    setFormData: Dispatch<SetStateAction<FormData>>;
    handleGetLoanOffer: () => void;
    isLoading: boolean;
    setCurrentStep: Dispatch<SetStateAction<number>>;
    errors: Record<string, string>;
    touched: Record<string, boolean>;
    handleBlur: (name: string) => void;
    apiError: string;
    setTouched: Dispatch<SetStateAction<Record<string, boolean>>>;
    validateField: (name: string, value: string) => boolean;
}) => {
    // Calculate section completion
    const isPersonalComplete = !!(formData.email && formData.dob && formData.gender);
    const isEmploymentComplete = !!(formData.employmentType && formData.monthlyIncome);
    const isAddressComplete = !!(formData.pincode && formData.building && formData.road && formData.city && formData.state);

    const completedSections = [isPersonalComplete, isEmploymentComplete, isAddressComplete].filter(Boolean).length;

    const progressWidth = completedSections === 0 ? 'w-0' : completedSections === 1 ? 'w-1/3' : completedSections === 2 ? 'w-2/3' : 'w-full';


    return (
        <div className="animate-slideUp h-full flex flex-col bg-white overflow-y-auto lg:pt-16">

            {/* Header with Back Button */}
            <div className="bg-white border-b border-gray-100 px-4 py-3 lg:px-12 lg:pt-6 lg:pb-3 lg:border-b-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setCurrentStep(3)} className="text-gray-500 hover:text-gray-700 transition-colors" id="back-to-step3-btn">
                            <ChevronLeft size={24} />
                        </button>
                        <span className="font-semibold text-gray-800">Loan</span>
                    </div>
                    <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center" id="step4-help-icon">
                        <HelpCircle size={16} className="text-abc-red" />
                    </div>
                </div>
            </div>

            {/* Form Content */}
            <div className="p-6 lg:px-12 lg:pt-2 lg:pb-4">
                {/* Progress */}
                <p className="text-gray-600 font-medium mb-2 text-sm">Basic details</p>
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-gray-500 text-xs">Step {completedSections}/3</span>
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`${progressWidth} h-full bg-green-500 rounded-full transition-all duration-300`} />
                    </div>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-6">Enter your details</h2>

                {/* Personal Details */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2">
                        <div className="w-1 h-5 bg-sky-400 rounded-full"></div>
                        <p className="font-semibold text-gray-800 text-base">Personal details</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Email */}
                        <div className="md:col-span-2">
                            <label className="text-gray-500 text-sm mb-2 block">Email (Required)</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                onBlur={() => handleBlur('email')}
                                className={`abc-input ${touched.email && errors.email ? 'border-red-500' : ''}`}
                                placeholder="Enter your email address"
                                id="email-input"
                            />
                            {touched.email && errors.email && (
                                <p className="text-red-500 text-xs mt-1 flex items-center gap-1" id="email-error">
                                    <AlertCircle size={12} />
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        {/* DOB */}
                        <div>
                            <label className="text-gray-500 text-sm mb-2 block">Date of birth (Required)</label>
                            <div className="relative">
                                <DatePicker
                                    selected={formData.dob ? new Date(formData.dob) : null}
                                    onChange={(date: Date | null) => {
                                        const dateValue = date ? date.toISOString().split('T')[0] : '';
                                        setFormData(prev => ({
                                            ...prev,
                                            dob: dateValue
                                        }));
                                        // Trigger instant validation
                                        setTouched(prev => ({ ...prev, dob: true }));
                                        validateField('dob', dateValue);
                                    }}
                                    onBlur={() => {
                                        setTouched(prev => ({ ...prev, dob: true }));
                                        validateField('dob', formData.dob);
                                    }}
                                    onCalendarClose={() => {
                                        setTouched(prev => ({ ...prev, dob: true }));
                                        validateField('dob', formData.dob);
                                    }}
                                    dateFormat="dd-MM-yyyy"
                                    showMonthDropdown
                                    showYearDropdown
                                    scrollableYearDropdown
                                    maxDate={new Date()}
                                    minDate={new Date('1950-01-01')}
                                    yearDropdownItemNumber={76}
                                    placeholderText="Select date of birth"
                                    className={`abc-input w-full pr-16 cursor-pointer ${touched.dob && errors.dob ? 'border-red-500' : ''}`}
                                    id="dob-input"
                                    wrapperClassName="w-full"
                                />
                                <div
                                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none"
                                >
                                    {formData.dob && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, dob: '' })); }}
                                            className="text-gray-400 hover:text-gray-600 transition-colors pointer-events-auto"
                                        >
                                            <X size={18} />
                                        </button>
                                    )}
                                    <Calendar size={18} className="text-abc-red" />
                                </div>
                            </div>
                            {touched.dob && errors.dob && (
                                <p className="text-red-500 text-xs mt-1 flex items-center gap-1" id="dob-error">
                                    <AlertCircle size={12} />
                                    {errors.dob}
                                </p>
                            )}
                        </div>

                        {/* Gender */}
                        <div
                            tabIndex={0}
                            onBlur={() => {
                                setTouched(prev => ({ ...prev, gender: true }));
                                validateField('gender', formData.gender);
                            }}
                            className="outline-none"
                        >
                            <label className="text-gray-500 text-sm mb-2 block">Gender</label>
                            <div className="flex gap-2" id="gender-toggle">
                                {['Male', 'Female', 'Other'].map(g => (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => {
                                            // Toggle: if already selected, deselect; otherwise select
                                            const newValue = formData.gender === g ? '' : g;
                                            setFormData(prev => ({ ...prev, gender: newValue }));
                                            setTouched(prev => ({ ...prev, gender: true }));
                                            validateField('gender', newValue);
                                        }}
                                        className={`toggle-btn flex-1 md:flex-none ${formData.gender === g ? 'active' : ''} ${touched.gender && errors.gender && !formData.gender ? 'border-red-500' : ''}`}
                                        id={`gender-${g.toLowerCase()}-btn`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                            {touched.gender && errors.gender && (
                                <p className="text-red-500 text-xs mt-1 flex items-center gap-1" id="gender-error">
                                    <AlertCircle size={12} />
                                    {errors.gender}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Employment Info */}
                    <div className="flex items-center gap-2 pt-6 pb-2 border-t border-gray-100 mt-6">
                        <div className="w-1 h-5 bg-sky-400 rounded-full"></div>
                        <p className="font-semibold text-gray-800 text-base">Employment information</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Employment Type */}
                        <div
                            tabIndex={0}
                            onBlur={() => {
                                setTouched(prev => ({ ...prev, employmentType: true }));
                                validateField('employmentType', formData.employmentType);
                            }}
                            className="outline-none"
                        >
                            <label className="text-gray-500 text-sm mb-2 block">Employment type</label>
                            <div className="flex gap-2" id="employment-toggle">
                                {['Salaried', 'Self-employed'].map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                            // Toggle: if already selected, deselect; otherwise select
                                            const newValue = formData.employmentType === t ? '' : t;
                                            setFormData(prev => ({ ...prev, employmentType: newValue }));
                                            setTouched(prev => ({ ...prev, employmentType: true }));
                                            validateField('employmentType', newValue);
                                        }}
                                        className={`toggle-btn flex-1 md:flex-none ${formData.employmentType === t ? 'active' : ''} ${touched.employmentType && errors.employmentType && !formData.employmentType ? 'border-red-500' : ''}`}
                                        id={`employment-${t.toLowerCase().replace('-', '')}-btn`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                            {touched.employmentType && errors.employmentType && (
                                <p className="text-red-500 text-xs mt-1 flex items-center gap-1" id="employment-error">
                                    <AlertCircle size={12} />
                                    {errors.employmentType}
                                </p>
                            )}
                        </div>

                        {/* Monthly Income */}
                        <div>
                            <label className="text-gray-500 text-sm mb-2 block">Monthly income</label>
                            <div className={`flex items-center bg-gray-100 rounded-lg border ${touched.monthlyIncome && errors.monthlyIncome ? 'border-red-500' : 'border-transparent'} focus-within:border-gray-300 focus-within:bg-white transition-all`}>
                                <span className="pl-4 pr-2 font-semibold text-gray-700">₹</span>
                                <input
                                    type="text"
                                    name="monthlyIncome"
                                    value={formData.monthlyIncome}
                                    onChange={handleChange}
                                    onBlur={() => handleBlur('monthlyIncome')}
                                    className="flex-1 px-2 py-3 bg-transparent focus:outline-none"
                                    placeholder="Enter monthly income"
                                    id="income-input"
                                />
                            </div>
                            {touched.monthlyIncome && errors.monthlyIncome && (
                                <p className="text-red-500 text-xs mt-1 flex items-center gap-1" id="income-error">
                                    <AlertCircle size={12} />
                                    {errors.monthlyIncome}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Residential Address */}
                    <div className="flex items-center gap-2 pt-6 pb-2 border-t border-gray-100 mt-6">
                        <div className="w-1 h-5 bg-sky-400 rounded-full"></div>
                        <p className="font-semibold text-gray-800 text-base">Residential address</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Building */}
                        <div>
                            <label className="text-gray-500 text-sm mb-2 block">House no., Building name (Required)</label>
                            <input
                                type="text"
                                name="building"
                                value={formData.building}
                                onChange={handleChange}
                                onBlur={() => handleBlur('building')}
                                className={`abc-input ${touched.building && errors.building ? 'border-red-500' : ''}`}
                                placeholder="Enter building name"
                                id="building-input"
                            />
                            {touched.building && errors.building && (
                                <p className="text-red-500 text-xs mt-1 flex items-center gap-1" id="building-error">
                                    <AlertCircle size={12} />
                                    {errors.building}
                                </p>
                            )}
                        </div>

                        {/* Road */}
                        <div>
                            <label className="text-gray-500 text-sm mb-2 block">Road name, area, colony (Required)</label>
                            <input
                                type="text"
                                name="road"
                                value={formData.road}
                                onChange={handleChange}
                                onBlur={() => handleBlur('road')}
                                className={`abc-input ${touched.road && errors.road ? 'border-red-500' : ''}`}
                                placeholder="Enter road name"
                                id="road-input"
                            />
                            {touched.road && errors.road && (
                                <p className="text-red-500 text-xs mt-1 flex items-center gap-1" id="road-error">
                                    <AlertCircle size={12} />
                                    {errors.road}
                                </p>
                            )}
                        </div>

                        {/* Pincode */}
                        <div>
                            <label className="text-gray-500 text-sm mb-2 block">Pincode (Required)</label>
                            <input
                                type="text"
                                name="pincode"
                                value={formData.pincode}
                                onChange={handleChange}
                                onBlur={() => handleBlur('pincode')}
                                maxLength={6}
                                className={`abc-input ${touched.pincode && errors.pincode ? 'border-red-500' : ''}`}
                                placeholder="Enter pincode"
                                id="pincode-input"
                            />
                            {touched.pincode && errors.pincode && (
                                <p className="text-red-500 text-xs mt-1 flex items-center gap-1" id="pincode-error">
                                    <AlertCircle size={12} />
                                    {errors.pincode}
                                </p>
                            )}
                        </div>

                        {/* City */}
                        <div>
                            <label className="text-gray-500 text-sm mb-2 block">City (Required)</label>
                            <input
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                onBlur={() => handleBlur('city')}
                                className={`abc-input ${touched.city && errors.city ? 'border-red-500' : ''}`}
                                placeholder="Enter city"
                                id="city-input"
                            />
                            {touched.city && errors.city && (
                                <p className="text-red-500 text-xs mt-1 flex items-center gap-1" id="city-error">
                                    <AlertCircle size={12} />
                                    {errors.city}
                                </p>
                            )}
                        </div>

                        {/* State - Custom Dropdown - Full Width */}
                        <div className="md:col-span-2">
                            <label className="text-gray-500 text-sm mb-2 block">State (Required)</label>
                            <div className="md:w-1/2">
                                <StateDropdown
                                    value={formData.state}
                                    onChange={(value) => setFormData(prev => ({ ...prev, state: value }))}
                                    onBlur={() => handleBlur('state')}
                                    error={!!(touched.state && errors.state)}
                                />
                            </div>
                            {touched.state && errors.state && (
                                <p className="text-red-500 text-xs mt-1 flex items-center gap-1" id="state-error">
                                    <AlertCircle size={12} />
                                    {errors.state}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Get Loan Offer Button - inside form, scrolls with content */}
                <div className="pt-6">
                    <button
                        onClick={handleGetLoanOffer}
                        disabled={isLoading}
                        className="w-full py-4 rounded-full abc-button text-gray-900 font-semibold text-lg disabled:opacity-70"
                        id="get-loan-offer-btn"
                    >
                        {isLoading ? 'Processing...' : 'Get Loan Offer Now'}
                    </button>
                    {apiError && (
                        <p className="text-red-500 text-sm mt-2 text-center flex items-center justify-center gap-1" id="api-error-step4">
                            <AlertCircle size={14} />
                            {apiError}
                        </p>
                    )}
                    <p className="text-center text-abc-red text-sm mt-3">How did you learn about us?</p>
                    <p className="text-center text-gray-400 text-xs mt-2">Powered by {CLIENT_NAME}</p>
                </div>
            </div>
        </div>

    );
};

// Step 5: Loan Offers
const Step5 = ({
    serviceError,
    loanOffers,
    setCurrentStep
}: {
    serviceError: boolean;
    loanOffers: LoanOffer[];
    setCurrentStep: Dispatch<SetStateAction<number>>;
}) => (
    <div className="animate-slideUp h-full flex flex-col bg-gray-50 overflow-y-auto lg:pt-16">

        {/* Header with Back Button */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 lg:px-8 lg:pt-6 lg:pb-3 lg:border-b-0 lg:bg-gray-50">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentStep(4)} className="text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-1" id="back-to-step4-btn">
                        <ChevronLeft size={20} />
                        <span className="font-medium">All offers</span>
                    </button>
                </div>
                <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center" id="step5-help-icon">
                    <HelpCircle size={16} className="text-abc-red" />
                </div>
            </div>
        </div>

        {/* Offers Content */}
        <div className="p-4 lg:px-8 lg:py-4">
            {/* Ranking Note */}
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-4" id="offers-header">
                <span className="w-4 h-4 border border-gray-300 rounded-full flex items-center justify-center text-[10px]">i</span>
                Ranking based on loan amount provided by lenders
            </div>

            {serviceError ? (
                /* Service Error State */
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center" id="service-error">
                    <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                    <h3 className="font-bold text-gray-800 mb-2">Lender service is temporarily unavailable</h3>
                    <p className="text-gray-600 text-sm mb-4">
                        Our lender systems are currently experiencing issues. Please try again later or connect with a Relationship Manager.
                    </p>
                    <button className="abc-button text-gray-900 px-6 py-3 rounded-full font-medium" id="connect-rm-btn">
                        Connect with RM
                    </button>
                </div>
            ) : (
                /* Loan Offers */
                <div className="grid grid-cols-1 gap-4" id="loan-offers-list">
                    {loanOffers.map((offer, index) => (
                        <div
                            key={index}
                            className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg hover:border-gray-300 transition-all duration-300"
                            id={`offer-card-${index}`}
                        >
                            {/* Header: Lender Logo & Loan Amount */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <LenderLogo name={offer.lender} />
                                    <span className="font-semibold text-gray-800">{offer.lender}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">Loan amount</p>
                                    <p className="font-bold text-xl text-gray-900">{offer.amount}</p>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-3 gap-4 py-3 border-t border-b border-gray-100 mb-4">
                                <div>
                                    <p className="text-gray-500 text-xs mb-1">Monthly EMI</p>
                                    <p className="font-semibold text-gray-800">{offer.emi}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs mb-1">Tenure</p>
                                    <p className="font-semibold text-gray-800">{offer.tenure}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs mb-1">APR</p>
                                    <p className="font-semibold text-gray-800">{offer.apr}</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between">
                                <button className="text-abc-red text-sm font-medium flex items-center gap-1 hover:underline" id={`view-kfs-btn-${index}`}>
                                    View KFS <ChevronRight size={16} />
                                </button>
                                <button className="abc-button text-gray-900 px-6 py-2.5 rounded-full text-sm font-semibold shadow-md hover:shadow-lg transition-shadow" id={`apply-now-btn-${index}`}>
                                    Apply now
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer Info */}
            {!serviceError && (
                <>
                    {/* KFS & APR Info Card */}
                    <div className="bg-white rounded-xl p-4 mt-6 flex items-center justify-between shadow-sm cursor-pointer hover:shadow-md transition-shadow" id="kfs-apr-info-card">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center">
                                <span className="text-sky-600 font-bold text-lg">?</span>
                            </div>
                            <span className="text-gray-600 font-medium">What are KFS & APR?</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-400" />
                    </div>

                    <p className="text-gray-400 text-xs mt-3 ml-1">*Amount is indicative</p>

                    {/* Lenders unable notice - Gradient Card */}
                    <div className="bg-gradient-to-r from-gray-50 to-pink-50 rounded-2xl p-4 mt-6 flex items-center justify-between" id="lenders-unable">
                        <p className="text-gray-600 text-sm font-medium pr-4">These lenders were unable to provide an offer at this time.</p>
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="flex -space-x-2">
                                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[10px] font-bold text-gray-800 shadow-sm border border-gray-100 z-10">fib</div>
                                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[10px] font-bold text-blue-600 shadow-sm border border-gray-100 z-20">RII</div>
                                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[10px] font-bold text-green-600 shadow-sm border border-gray-100 z-30">P</div>
                            </div>
                            <ChevronRight size={18} className="text-abc-red ml-1" />
                        </div>
                    </div>
                </>
            )}
        </div>
    </div>
);

// const Navbar = () => {
//     const navigate = useNavigate();
//     return (
//         <nav className="flex items-center justify-between px-4 py-3 bg-white sticky top-0 z-50">
//             <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => navigate('/home')} id="navbar-home-link">
//                 <img src="/abcd.png" alt="Logo" className="h-7 w-auto object-contain group-hover:scale-105 transition-transform" />
//                 <div className="flex flex-col">
//                     <span className="text-sm font-bold text-gray-900 leading-none group-hover:text-red-600 transition-colors">Aditya Birla Capital Digital</span>
//                     <span className="text-[10px] text-gray-500 font-medium tracking-wide">Loan Application</span>
//                 </div>
//             </div>
//         </nav>
//     );
// };

const ABCDLoanJourney = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState<FormData>({
        phone: '',
        termsAccepted: false,
        otp: ['', '', '', '', '', ''],
        pan: '',
        fullName: '',
        consent1: false,
        consent2: false,
        email: '',
        dob: '',
        gender: '',
        employmentType: '',
        monthlyIncome: '',
        pincode: '',
        building: '',
        road: '',
        city: '',
        state: '',
    });

    // Validation errors state
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    const [otpError, setOtpError] = useState(false);
    const [otpLengthError, setOtpLengthError] = useState(false);
    const [resendOtpError, setResendOtpError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState('');

    const [serviceError, setServiceError] = useState(false);
    const [otpTimer, setOtpTimer] = useState(30);

    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Validation functions
    const validators = {
        phone: (value: string) => {
            if (!value) return 'Phone number is required';
            if (!/^\d{10}$/.test(value)) return 'Phone must be 10 digits';
            return '';
        },
        email: (value: string) => {
            if (!value) return 'Email is required';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
            return '';
        },
        pan: (value: string) => {
            if (!value) return 'PAN is required';
            if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value.toUpperCase())) return 'Invalid PAN format (e.g., ABCDE1234F)';
            return '';
        },
        fullName: (value: string) => {
            if (!value) return 'Full name is required';
            if (value.length < 3) return 'Name must be at least 3 characters';
            if (!/^[a-zA-Z\s]+$/.test(value)) return 'Name can only contain letters';
            return '';
        },
        dob: (value: string) => {
            if (!value) return 'Date of birth is required';
            const birthDate = new Date(value);
            const today = new Date();
            const age = today.getFullYear() - birthDate.getFullYear();
            if (age < 23) return 'You must be at least 23 years old';
            if (age > 60) return 'Maximum age limit is 60 years';
            return '';
        },
        monthlyIncome: (value: string) => {
            if (!value) return 'Monthly income is required';
            const income = parseInt(value.replace(/,/g, ''));
            if (isNaN(income)) return 'Enter a valid amount';
            if (income < 15000) return 'Minimum income required is ₹15,000';
            return '';
        },
        gender: (value: string) => {
            if (!value) return 'Please select gender';
            return '';
        },
        employmentType: (value: string) => {
            if (!value) return 'Please select employment type';
            return '';
        },
        pincode: (value: string) => {
            if (!value) return 'Pincode is required';
            if (!/^\d{6}$/.test(value)) return 'Pincode must be 6 digits';
            return '';
        },
        building: (value: string) => {
            if (!value) return 'Building/House no. is required';
            if (value.length < 6) return 'Must be at least 6 characters';
            return '';
        },
        road: (value: string) => {
            if (!value) return 'Road/Area is required';
            if (value.length < 6) return 'Must be at least 6 characters';
            return '';
        },
        city: (value: string) => {
            if (!value) return 'City is required';
            if (value.length < 3) return 'Must be at least 3 characters';
            return '';
        },
        state: (value: string) => {
            if (!value) return 'State is required';
            return '';
        },
    };

    // Validate single field
    const validateField = (name: string, value: string) => {
        const validator = validators[name as keyof typeof validators];
        if (validator) {
            const error = validator(value);
            setErrors(prev => ({ ...prev, [name]: error }));
            return error === '';
        }
        return true;
    };

    // Mark field as touched (for showing errors on blur)
    const handleBlur = (name: string) => {
        setTouched(prev => ({ ...prev, [name]: true }));
        validateField(name, formData[name as keyof FormData] as string);
    };

    // OTP Timer
    useEffect(() => {
        if (currentStep === 2 && otpTimer > 0) {
            const timer = setInterval(() => setOtpTimer(t => t - 1), 1000);
            return () => clearInterval(timer);
        }
    }, [currentStep, otpTimer]);



    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;
        setFormData(prev => ({
            ...prev,
            [name]: newValue
        }));
        // Always validate on change for instant feedback
        if (typeof newValue === 'string') {
            setTouched(prev => ({ ...prev, [name]: true }));
            validateField(name, newValue);
        }
        // Clear API error when user starts typing
        if (apiError) {
            setApiError('');
        }
    };

    // Step handlers
    const handleApplyNow = async () => {
        if (formData.phone.length === 10 && formData.termsAccepted) {
            setIsLoading(true);
            setApiError(''); // Clear any previous API error

            try {
                // const response = await sendOtp({
                //     country_code: '+91',
                //     phone: formData.phone
                // });

                // if (response.success) {
                    // Clear OTP state when moving to OTP step
                    setFormData(prev => ({ ...prev, otp: ['', '', '', '', '', ''] }));
                    setOtpError(false);
                    setOtpLengthError(false);
                    setOtpTimer(30);
                    setCurrentStep(2);
                // } else {
                //     // Show API error below button
                //     setApiError(response.error || 'Failed to send OTP. Please try again.');
                // }
            } catch (error) {
                setApiError('Network error. Please try again.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleEditPhone = () => {
        // Clear OTP state when going back to step 1
        setFormData(prev => ({ ...prev, otp: ['', '', '', '', '', ''] }));
        setOtpError(false);
        setOtpLengthError(false);
        setResendOtpError('');
        setOtpTimer(30);
        setCurrentStep(1);
    };

    const handleResendOtp = async () => {
        setResendOtpError('');
        setOtpError(false);
        setOtpLengthError(false);
        setFormData(prev => ({ ...prev, otp: ['', '', '', '', '', ''] }));

        try {
            const response = await sendOtp({
                phone: formData.phone,
                country_code: '+91'
            });

            if (response.success) {
                setOtpTimer(30);
            } else {
                setResendOtpError(response.error || 'Failed to resend OTP. Please try again.');
            }
        } catch (error) {
            setResendOtpError('Network error. Please try again.');
        }
    };

    const handleVerifyOtp = async () => {
        const enteredOtp = formData.otp.join('');
        setIsLoading(true);

        try {
            // const response = await verifyOtp({
            //     phone: formData.phone,
            //     country_code: '+91',
            //     otp: enteredOtp
            // });

            if (enteredOtp === '123456') {
                setCurrentStep(3);
                setOtpError(false);
            } else {
                setOtpError(true);
            }
        } catch (error) {
            setOtpError(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleContinueStep3 = () => {
        // Mark Step3 fields as touched to show validation errors
        const step3Fields = ['pan', 'fullName'];
        const newTouched: Record<string, boolean> = {};
        step3Fields.forEach(field => {
            newTouched[field] = true;
        });
        setTouched(prev => ({ ...prev, ...newTouched }));

        // Validate all Step3 fields
        let hasErrors = false;
        const newErrors: Record<string, string> = {};
        step3Fields.forEach(field => {
            const validator = validators[field as keyof typeof validators];
            if (validator) {
                const error = validator(formData[field as keyof FormData] as string);
                if (error) {
                    hasErrors = true;
                    newErrors[field] = error;
                }
            }
        });
        setErrors(prev => ({ ...prev, ...newErrors }));

        // Don't proceed if there are validation errors or consents not checked
        if (hasErrors || !formData.consent1 || !formData.consent2) {
            return;
        }

        setCurrentStep(4);
    };

    const handleGetLoanOffer = async () => {
        // Mark all Step4 fields as touched to show validation errors
        const step4Fields = ['email', 'dob', 'gender', 'employmentType', 'monthlyIncome', 'pincode', 'building', 'road', 'city', 'state'];
        const newTouched: Record<string, boolean> = {};
        step4Fields.forEach(field => {
            newTouched[field] = true;
        });
        setTouched(prev => ({ ...prev, ...newTouched }));

        // Validate all Step4 fields
        let hasErrors = false;
        const newErrors: Record<string, string> = {};
        step4Fields.forEach(field => {
            const validator = validators[field as keyof typeof validators];
            if (validator) {
                const error = validator(formData[field as keyof FormData] as string);
                if (error) {
                    hasErrors = true;
                    newErrors[field] = error;
                }
            }
        });
        setErrors(prev => ({ ...prev, ...newErrors }));

        // Don't proceed if there are validation errors
        if (hasErrors) {
            return;
        }

        setIsLoading(true);

        // Edge Case: If email is rohanpatra@gmail.com, simulate lender service down
        if (formData.email.toLowerCase() === 'rohanpatra@gmail.com') {
            setServiceError(true);
            setCurrentStep(5);
            setIsLoading(false);
            return;
        }

        try {
            const response = await createApplication({
                full_name: formData.fullName,
                pan: formData.pan,
                dob: formData.dob,
                email: formData.email,
                gender: formData.gender,
                employment_type: formData.employmentType,
                monthly_income: parseInt(formData.monthlyIncome.replace(/,/g, '')),
                address_line_1: formData.building,
                address_line_2: formData.road,
                city: formData.city,
                state: formData.state,
                pin_code: formData.pincode,
                country_code: '+91',
                phone: formData.phone
            });

            if (response.success) {
                // Application created successfully
                // Navigate to success page or show loan offers
                console.log('Application ID:', response.data?.application_id);
                setCurrentStep(5);
                setServiceError(false);
                setApiError('');
            } else {
                // Show API error below button (stay on current step)
                setApiError(response.error || 'Failed to submit application. Please try again.');
            }
        } catch (error) {
            console.error('Application submission error:', error);
            setApiError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Loan offers data (hardcoded for demo)
    const loanOffers: LoanOffer[] = [
        { lender: 'L&T Finance', amount: '₹4,00,000*', emi: '₹10,500', tenure: '48 months', apr: '12%' },
        { lender: CLIENT_NAME, amount: '₹4,60,000*', emi: '₹12,000', tenure: '48 months', apr: '12%' },
    ];

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <Step1
                        formData={formData}
                        handleChange={handleChange}
                        handleApplyNow={handleApplyNow}
                        errors={errors}
                        touched={touched}
                        handleBlur={handleBlur}
                        isLoading={isLoading}
                        apiError={apiError}
                    />
                );
            case 2:
                return (
                    <Step2
                        formData={formData}
                        setFormData={setFormData}
                        setOtpError={setOtpError}
                        setOtpLengthError={setOtpLengthError}
                        handleVerifyOtp={handleVerifyOtp}
                        handleResendOtp={handleResendOtp}
                        otpTimer={otpTimer}
                        otpError={otpError}
                        otpLengthError={otpLengthError}
                        resendOtpError={resendOtpError}
                        otpRefs={otpRefs}
                        handleEditPhone={handleEditPhone}
                        isLoading={isLoading}
                    />
                );
            case 3:
                return (
                    <Step3
                        formData={formData}
                        handleChange={handleChange}
                        setFormData={setFormData}
                        handleContinueStep3={handleContinueStep3}
                        errors={errors}
                        touched={touched}
                        handleBlur={handleBlur}
                    />
                );
            case 4:
                return (
                    <Step4
                        formData={formData}
                        handleChange={handleChange}
                        setFormData={setFormData}
                        handleGetLoanOffer={handleGetLoanOffer}
                        isLoading={isLoading}
                        setCurrentStep={setCurrentStep}
                        errors={errors}
                        touched={touched}
                        handleBlur={handleBlur}
                        apiError={apiError}
                        setTouched={setTouched}
                        validateField={validateField}
                    />
                );
            case 5:
                return (
                    <Step5
                        serviceError={serviceError}
                        loanOffers={loanOffers}
                        setCurrentStep={setCurrentStep}
                    />
                );
            default:
                return (
                    <Step1
                        formData={formData}
                        handleChange={handleChange}
                        handleApplyNow={handleApplyNow}
                        errors={errors}
                        touched={touched}
                        handleBlur={handleBlur}
                        isLoading={isLoading}
                        apiError={apiError}
                    />
                );
        }
    };

    return (
        <div className="font-inter min-h-screen flex flex-col bg-gradient-to-r from-sky-400 to-sky-400 lg:bg-none lg:bg-white lg:h-screen lg:max-h-screen lg:overflow-hidden overflow-x-hidden">

            {/* Navbar */}
            {/* <Navbar /> */}

            {/* Custom Header Overlay - Desktop Only */}
            <div className="hidden lg:block absolute top-0 left-0 right-0 z-50">
                {/* Images Container - Responsive Layout */}
                <div className="w-full flex justify-between lg:grid lg:grid-cols-2 items-center px-4 py-3">
                    {/* Left Side Logo */}
                    {/* Mobile: Left Aligned | Desktop: Right Aligned (near center) */}
                    <div className="flex justify-start lg:justify-end lg:pr-8 w-auto lg:w-full">
                        <div
                            className="bg-white p-1.5 rounded-lg shadow-sm lg:shadow-[0_0_25px_rgba(255,255,255,0.5)] cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => navigate('/home')}
                        >
                            <img
                                src={CLIENT_LOGO}
                                alt={CLIENT_NAME}
                                className="h-8 lg:h-12 w-auto object-contain"
                            />
                        </div>
                    </div>

                    {/* Right Side Logo */}
                    <div className="flex justify-end lg:justify-start lg:pl-8 w-auto lg:w-full">
                        <div
                            className="bg-white p-2 rounded-lg shadow-md border border-gray-100 cursor-pointer hover:scale-105 transition-transform overflow-hidden"
                            onClick={() => navigate('/home')}
                        >
                            <img
                                src={CLIENT_LOGO}
                                alt={CLIENT_NAME}
                                className="h-8 lg:h-12 w-auto object-contain"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Layout: vertical scroll with HeroSection at top */}
            <div className="lg:hidden flex flex-col flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="flex-shrink-0 overflow-hidden">
                    {/* Mobile Header (In-flow) */}
                    <div className="w-full flex justify-between items-center px-4 py-3">
                        <div
                            className="bg-white p-1.5 rounded-lg shadow-sm cursor-pointer"
                            onClick={() => navigate('/home')}
                        >
                            <img
                                src={CLIENT_LOGO}
                                alt={CLIENT_NAME}
                                className="h-8 w-auto object-contain"
                            />
                        </div>
                    </div>

                    <HeroSection />
                </div>
                <div className="flex-1 bg-white">
                    {renderStep()}
                </div>
            </div>

            {/* Desktop Layout: side by side */}
            <div className="hidden lg:flex lg:flex-1 lg:overflow-hidden">
                <div className="lg:w-1/2 h-full bg-gradient-to-r from-sky-400 to-sky-400 overflow-hidden">
                    <HeroSection />
                </div>
                <div className="lg:w-1/2 h-full overflow-y-auto overflow-x-hidden relative lg:pt-16">
                    {renderStep()}
                </div>
            </div>
        </div>
    );
};

export default ABCDLoanJourney;
