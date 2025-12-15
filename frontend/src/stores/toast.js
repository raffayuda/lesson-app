import { writable } from 'svelte/store';

function createToastStore() {
    const { subscribe, update } = writable([]);
    
    let nextId = 1;
    
    function add(message, type = 'info', duration = 3000) {
        const id = nextId++;
        const toast = { id, message, type };
        
        update(toasts => [...toasts, toast]);
        
        if (duration > 0) {
            setTimeout(() => {
                remove(id);
            }, duration);
        }
        
        return id;
    }
    
    function remove(id) {
        update(toasts => toasts.filter(t => t.id !== id));
    }
    
    function clear() {
        update(() => []);
    }
    
    return {
        subscribe,
        success: (message, duration) => add(message, 'success', duration),
        error: (message, duration) => add(message, 'error', duration),
        warning: (message, duration) => add(message, 'warning', duration),
        info: (message, duration) => add(message, 'info', duration),
        remove,
        clear
    };
}

export const toastStore = createToastStore();
