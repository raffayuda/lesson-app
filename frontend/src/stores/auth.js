import { writable } from 'svelte/store';

const API_URL = import.meta.env.PROD ? '/api' : 'http://10.166.243.254:5173/api';

// Session timeout: 1 hour (in milliseconds)
const SESSION_TIMEOUT = 60 * 60  * 1000; // 1 hour

function createAuthStore() {
    const { subscribe, set, update } = writable({
        user: null,
        token: null,
        loading: true
    });

    // Check if session is expired
    function checkSessionExpiry() {
        const lastActivity = localStorage.getItem('lastActivity');
        if (lastActivity) {
            const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
            if (timeSinceLastActivity > SESSION_TIMEOUT) {
                // Session expired
                localStorage.removeItem('token');
                localStorage.removeItem('lastActivity');
                return true;
            }
        }
        return false;
    }

    // Update last activity timestamp
    function updateLastActivity() {
        localStorage.setItem('lastActivity', Date.now().toString());
    }

    // Initialize activity tracking
    function initActivityTracking() {
        if (typeof window !== 'undefined') {
            // Update activity on any user interaction
            const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
            events.forEach(event => {
                window.addEventListener(event, updateLastActivity, { passive: true });
            });

            // Update activity periodically (every 30 seconds)
            setInterval(() => {
                const token = localStorage.getItem('token');
                if (token) {
                    updateLastActivity();
                }
            }, 30000);
        }
    }

    return {
        subscribe,

        async init() {
            // Check if session expired first
            if (checkSessionExpiry()) {
                set({ user: null, token: null, loading: false });
                return;
            }

            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const response = await fetch(`${API_URL}/auth/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (response.ok) {
                        const user = await response.json();
                        set({ user, token, loading: false });
                        // Update activity timestamp and start tracking
                        updateLastActivity();
                        initActivityTracking();
                    } else {
                        localStorage.removeItem('token');
                        localStorage.removeItem('lastActivity');
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
                
                // Set initial activity timestamp and start tracking
                updateLastActivity();
                initActivityTracking();
                
                return user;
            } catch (error) {
                throw error;
            }
        },

        logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('lastActivity');
            set({ user: null, token: null, loading: false });
        },

        updateUser(user) {
            const token = localStorage.getItem('token');
            update(state => ({ ...state, user, token }));
        },

        getToken() {
            return localStorage.getItem('token');
        }
    };
}

export const auth = createAuthStore();
export { API_URL };
