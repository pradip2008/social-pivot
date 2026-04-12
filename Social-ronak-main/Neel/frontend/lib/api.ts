import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    timeout: 30000,
});

api.interceptors.request.use((config) => {
    const token = Cookies.get('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Retry logic: 3 retries with exponential backoff for network errors / 5xx
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config;
        if (!config) return Promise.reject(error);

        // Initialize retry count
        config.__retryCount = config.__retryCount || 0;

        const isNetworkError = !error.response;
        const isServerError = error.response && error.response.status >= 500;
        const isRetryable = (isNetworkError || isServerError) && config.__retryCount < 3;

        // Don't retry POST requests to prevent duplicate submissions or large payload lockups
        const isSafeMethod = ['get', 'head', 'options'].includes((config.method || '').toLowerCase());
        
        // Prevent retrying multipart/form-data (media uploads)
        const isMultipart = config.headers && config.headers['Content-Type'] && config.headers['Content-Type'].toString().includes('multipart/form-data');

        if (isRetryable && isSafeMethod && !isMultipart) {
            config.__retryCount += 1;
            const delay = Math.pow(2, config.__retryCount) * 500; // 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, delay));
            return api(config);
        }

        // Handle 401 — redirect to login
        if (error.response && error.response.status === 401) {
            Cookies.remove('token');
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/feed') && !window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default api;
