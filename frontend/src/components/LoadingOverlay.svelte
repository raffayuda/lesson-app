<script>
    export let show = false;
    export let message = "Processing...";
</script>

{#if show}
    <div class="fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm border border-gray-200 dark:border-gray-700">
            <div class="relative">
                <div class="w-16 h-16 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            <div class="text-center">
                <p class="text-lg font-semibold text-gray-900 dark:text-white">{message}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Please wait...</p>
            </div>
        </div>
    </div>
{/if}

<style>
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    .fixed {
        animation: fadeIn 0.2s ease-out;
    }
</style>
