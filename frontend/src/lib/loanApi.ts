/**
 * Loan Application API Service
 * Handles all API calls for the loan application flow
 */

// Get base URL from WebSocket URL (extract host from ws:// or wss://)
const getApiBaseUrl = (): string => {
    const wsUrl = import.meta.env.VITE_BACKEND_WS_URL || 'ws://localhost:8000/ws';
    // Convert ws:// to http:// and wss:// to https://
    const httpUrl = wsUrl.replace(/^wss?:\/\//, (match) => match === 'wss://' ? 'https://' : 'http://');
    // Remove /ws path
    return httpUrl.replace(/\/ws$/, '');
};

const API_BASE_URL = getApiBaseUrl();

// Type definitions for API

/**
 * Step 1: Send OTP Request
 * Only requires phone number and country code
 */
export interface SendOtpRequest {
    country_code: string;
    phone: string;
}

/**
 * Step 2: Verify OTP Request
 * Requires phone number, country code, and OTP
 */
export interface VerifyOtpRequest {
    phone: string;
    country_code: string;
    otp: string;
}

/**
 * Step 3: Create Loan Application Request
 * Includes all user details collected across all steps
 */
export interface CreateApplicationRequest {
    full_name: string;
    pan: string;
    dob: string; // Format: YYYY-MM-DD
    email: string;
    gender: string; // "Male" | "Female" | "Other"
    employment_type: string;
    monthly_income: number;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    pin_code: string;
    country_code: string;
    phone: string;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
}

export interface SendOtpResponse {
    message: string;
}

export interface VerifyOtpResponse {
    message: string;
}

export interface CreateApplicationResponse {
    message: string;
    application_id: string;
}

/**
 * Send OTP to phone number
 * Stores form data temporarily until OTP is verified
 */
export const sendOtp = async (data: SendOtpRequest): Promise<ApiResponse<SendOtpResponse>> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/loan/send-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.detail || result.message || 'Failed to send OTP',
            };
        }

        return {
            success: true,
            data: result,
            message: result.message || 'OTP sent successfully',
        };
    } catch (error) {
        console.error('Send OTP Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error. Please try again.',
        };
    }
};

/**
 * Verify OTP and submit loan application
 * On success, returns success message
 */
export const verifyOtp = async (data: VerifyOtpRequest): Promise<ApiResponse<VerifyOtpResponse>> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/loan/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.detail || result.message || 'OTP verification failed',
            };
        }

        return {
            success: true,
            data: result,
            message: result.message || 'OTP verified successfully',
        };
    } catch (error) {
        console.error('Verify OTP Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error. Please try again.',
        };
    }
};

/**
 * Create Loan Application (Step 3)
 * Submit complete loan application with all user details
 * On success, saves application and returns Application ID
 */
export const createApplication = async (data: CreateApplicationRequest): Promise<ApiResponse<CreateApplicationResponse>> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/loan/applications`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.detail || result.message || 'Failed to create loan application',
            };
        }

        return {
            success: true,
            data: result,
            message: result.message || 'Application submitted successfully',
        };
    } catch (error) {
        console.error('Create Application Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error. Please try again.',
        };
    }
};

// Loan Application List Types
export interface LoanApplicationItem {
    id: string;
    application_id: string;
    full_name: string;
    phone: string;
    created_at: string;
}

/**
 * Get list of all loan applications
 */
export const getApplications = async (): Promise<ApiResponse<LoanApplicationItem[]>> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/loan/applications`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.detail || result.message || 'Failed to fetch applications',
            };
        }

        return {
            success: true,
            data: result,
        };
    } catch (error) {
        console.error('Get Applications Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error. Please try again.',
        };
    }
};

// Detailed Application Type (full details from single application fetch)
export interface LoanApplicationDetail {
    id: string;
    application_id: string;
    full_name: string;
    pan: string;
    dob: string;
    phone: string;
    email: string;
    gender: string;
    employment_type: string;
    monthly_income: number;
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    pin_code: string;
    created_at: string;
    updated_at: string;
}

/**
 * Get single loan application by Application ID
 */
export const getApplicationById = async (applicationId: string): Promise<ApiResponse<LoanApplicationDetail>> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/loan/applications/${applicationId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.detail || result.message || 'Application not found',
            };
        }

        return {
            success: true,
            data: result,
        };
    } catch (error) {
        console.error('Get Application Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error. Please try again.',
        };
    }
};
