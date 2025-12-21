<script>
    import { createEventDispatcher } from 'svelte';
    
    export let show = false;
    export let title = "Konfirmasi";
    export let message = "Apakah Anda yakin?";
    export let confirmText = "OK";
    export let cancelText = "Batal";
    export let type = "confirm"; // "confirm" or "alert"
    export let danger = false;
    
    const dispatch = createEventDispatcher();
    
    function handleConfirm() {
        dispatch('confirm');
        show = false;
    }
    
    function handleCancel() {
        dispatch('cancel');
        show = false;
    }
    
    function handleBackdropClick(e) {
        if (e.target === e.currentTarget) {
            handleCancel();
        }
    }
</script>

{#if show}
    <div 
        class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        on:click={handleBackdropClick}
        on:keydown={(e) => e.key === 'Escape' && handleCancel()}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
    >
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full transform transition-all border border-gray-200 dark:border-gray-700">
            <!-- Header -->
            <div class="p-6 pb-4">
                <div class="flex items-center gap-4">
                    {#if danger}
                        <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <i class="fas fa-exclamation-triangle text-red-600 dark:text-red-400 text-xl"></i>
                        </div>
                    {:else}
                        <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <i class="fas fa-info-circle text-blue-600 dark:text-blue-400 text-xl"></i>
                        </div>
                    {/if}
                    <div class="flex-1">
                        <h3 class="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
                    </div>
                </div>
            </div>
            
            <!-- Body -->
            <div class="px-6 pb-6">
                <p class="text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>
            </div>
            
            <!-- Footer -->
            <div class="flex gap-3 p-6 pt-0 {type === 'confirm' ? 'justify-end' : 'justify-center'}">
                {#if type === 'confirm'}
                    <button
                        on:click={handleCancel}
                        class="px-6 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600"
                    >
                        {cancelText}
                    </button>
                {/if}
                <button
                    on:click={handleConfirm}
                    class="px-6 py-2.5 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 {danger ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-lg shadow-red-500/30' : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 shadow-lg shadow-blue-500/30'}"
                >
                    {confirmText}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes slideUp {
        from { 
            opacity: 0;
            transform: translateY(20px);
        }
        to { 
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .fixed {
        animation: fadeIn 0.2s ease-out;
    }
    
    .bg-white {
        animation: slideUp 0.3s ease-out;
    }
</style>
