<script>
    export let title = "";
    export let value = "";
    export let icon = "";
    export let trend = null; // { value: number, isPositive: boolean }
    export let color = "blue"; // blue, green, purple, orange
    
    const colorClasses = {
        blue: 'from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700',
        green: 'from-green-500 to-green-600 dark:from-green-600 dark:to-green-700',
        purple: 'from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700',
        orange: 'from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700',
        red: 'from-red-500 to-red-600 dark:from-red-600 dark:to-red-700',
    };
    
    $: gradientClass = colorClasses[color] || colorClasses.blue;
</script>

<div
    class="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 group"
>
    <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br {gradientClass} opacity-10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
    
    <div class="relative flex items-start justify-between">
        <div class="flex-1">
            <p class="text-gray-600 dark:text-gray-400 text-sm font-medium mb-2">{title}</p>
            <p class="text-4xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>

            {#if trend}
                <div class="mt-3 flex items-center gap-1.5 text-sm">
                    <span
                        class="flex items-center gap-1 px-2 py-0.5 rounded-full {trend.isPositive
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}"
                    >
                        <i class="fas fa-arrow-{trend.isPositive ? 'up' : 'down'} text-xs"></i>
                        {Math.abs(trend.value)}%
                    </span>
                    <span class="text-gray-500 dark:text-gray-400">vs yesterday</span>
                </div>
            {/if}
        </div>

        {#if icon}
            <div class="w-14 h-14 rounded-xl bg-gradient-to-br {gradientClass} flex items-center justify-center shadow-lg">
                <i class="fas {icon} text-2xl text-white"></i>
            </div>
        {/if}
    </div>
</div>
