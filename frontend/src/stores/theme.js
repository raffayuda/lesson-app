import { writable } from 'svelte/store';

// Check if running in browser
const isBrowser = typeof window !== 'undefined';

function createThemeStore() {
    // Check localStorage or system preference
    const storedTheme = isBrowser ? localStorage.getItem('theme') : null;
    const systemPrefersDark = isBrowser ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
    const initialTheme = storedTheme || (systemPrefersDark ? 'dark' : 'light');
    
    const { subscribe, set, update } = writable(initialTheme);
    
    // Apply theme to document
    if (isBrowser && initialTheme === 'dark') {
        document.documentElement.classList.add('dark');
        console.log('Initial theme: dark mode enabled');
    } else if (isBrowser && initialTheme === 'light') {
        document.documentElement.classList.remove('dark');
        console.log('Initial theme: light mode enabled');
    }
    
    console.log('Theme store initialized:', { initialTheme, storedTheme, systemPrefersDark });
    
    return {
        subscribe,
        toggle: () => {
            if (!isBrowser) {
                console.log('Not in browser, toggle skipped');
                return;
            }
            
            update(theme => {
                const newTheme = theme === 'light' ? 'dark' : 'light';
                console.log('Theme toggled:', theme, '->', newTheme);
                localStorage.setItem('theme', newTheme);
                
                if (newTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                    console.log('Added dark class to document');
                } else {
                    document.documentElement.classList.remove('dark');
                    console.log('Removed dark class from document');
                }
                
                return newTheme;
            });
        },
        set: (newTheme) => {
            if (!isBrowser) return;
            
            localStorage.setItem('theme', newTheme);
            
            if (newTheme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            
            set(newTheme);
        }
    };
}

export const theme = createThemeStore();
