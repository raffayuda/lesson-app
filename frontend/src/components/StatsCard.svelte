<script>
    export let title = "";
    export let value = "";
    export let icon = "";
    export let trend = null; // { value: number, isPositive: boolean }
</script>

<div
    class="bg-primary-900/50 backdrop-blur-sm border border-primary-800 rounded-lg p-6 hover:border-primary-700 transition-all duration-200"
>
    <div class="flex items-start justify-between">
        <div class="flex-1">
            <p class="text-primary-400 text-sm font-medium mb-1">{title}</p>
            <p class="text-3xl font-bold text-primary-50">{value}</p>

            {#if trend}
                <div class="mt-2 flex items-center gap-1 text-sm">
                    <span
                        class={trend.isPositive
                            ? "text-green-400"
                            : "text-red-400"}
                    >
                        {trend.isPositive ? "↑" : "↓"}
                        {Math.abs(trend.value)}%
                    </span>
                    <span class="text-primary-500">vs yesterday</span>
                </div>
            {/if}
        </div>

        {#if icon}
            <div class="text-3xl opacity-50">{icon}</div>
        {/if}
    </div>
</div>
