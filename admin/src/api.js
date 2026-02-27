import axios from 'axios';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    withCredentials: true,
});

// Attach JWT token from localStorage to every request
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('pp_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Redirect to login on 401
API.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('pp_token');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export default API;
