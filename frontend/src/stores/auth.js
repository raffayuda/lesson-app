import { writable } from 'svelte/store';

const API_URL = import.meta.env.PROD ? '/api' : 'http://10.166.243.254:3000/api';

function createAuthStore() {
    const { subscribe, set, update } = writable({
        user: null,
        token: null,
        loading: true
    });

    return {
        subscribe,

        async init() {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const response = await fetch(`${API_URL}/auth/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (response.ok) {
                        const user = await response.json();
                        set({ user, token, loading: false });
                    } else {
                        localStorage.removeItem('token');
                        set({ user: null, token: null, loading: false });
                    }
                } catch (error) {
                    console.error('Auth init error:', error);
                    set({ user: null, token: null, loading: false });
                }
            } else {
                set({ user: null, token: null, loading: false });
            }
        },

        async login(email, password) {
            try {
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Login failed');
                }

                const { token, user } = await response.json();
                localStorage.setItem('token', token);
                set({ user, token, loading: false });
                return user;
            } catch (error) {
                throw error;
            }
        },

        logout() {
            localStorage.removeItem('token');
            set({ user: null, token: null, loading: false });
        },

        getToken() {
            return localStorage.getItem('token');
        }
    };
}

export const auth = createAuthStore();
export { API_URL };
