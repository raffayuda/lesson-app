<script>
    import { onMount } from 'svelte';
    import { toastStore } from '../stores/toast.js';
    
    let toasts = [];
    
    onMount(() => {
        const unsubscribe = toastStore.subscribe(value => {
            toasts = value;
        });
        
        return unsubscribe;
    });
    
    function removeToast(id) {
        toastStore.remove(id);
    }
    
    function getIcon(type) {
        switch(type) {
            case 'success':
                return 'fa-check-circle';
            case 'error':
                return 'fa-times-circle';
            case 'warning':
                return 'fa-exclamation-triangle';
            case 'info':
                return 'fa-info-circle';
            default:
                return 'fa-info-circle';
        }
    }
    
    function getColors(type) {
        switch(type) {
            case 'success':
                return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200';
            case 'error':
                return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
            case 'warning':
                return 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200';
            case 'info':
                return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
            default:
                return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200';
        }
    }
    
    function getIconColor(type) {
        switch(type) {
            case 'success':
                return 'text-green-600 dark:text-green-400';
            case 'error':
                return 'text-red-600 dark:text-red-400';
            case 'warning':
                return 'text-yellow-600 dark:text-yellow-400';
            case 'info':
                return 'text-blue-600 dark:text-blue-400';
            default:
                return 'text-gray-600 dark:text-gray-400';
        }
    }
</script>

<div class="fixed top-20 right-4 z-50 space-y-3 max-w-sm w-full pointer-events-none">
    {#each toasts as toast (toast.id)}
        <div 
            class="toast pointer-events-auto {getColors(toast.type)} border rounded-xl shadow-xl backdrop-blur-sm p-4 flex items-start gap-3 transform transition-all"
            role="alert"
        >
            <div class="flex-shrink-0">
                <i class="fas {getIcon(toast.type)} {getIconColor(toast.type)} text-xl"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-medium text-sm">{toast.message}</p>
            </div>
            <button 
                on:click={() => removeToast(toast.id)}
                class="flex-shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
                <i class="fas fa-times"></i>
            </button>
        </div>
    {/each}
</div>

<style>
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
    
    .toast {
        animation: slideInRight 0.3s ease-out;
    }
    
    .toast.removing {
        animation: slideOutRight 0.2s ease-in forwards;
    }
</style>
