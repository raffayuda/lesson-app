<script>
    import { auth } from "../stores/auth.js";
    import { location } from "svelte-spa-router";
    import { theme } from "../stores/theme.js";

    export let activePage = "/";

    const adminMenu = [
        { icon: "fa-chart-line", label: "Dashboard", path: "/" },
        { icon: "fa-calendar-alt", label: "Schedules", path: "/schedules" },
        { icon: "fa-users", label: "Students", path: "/students" },
        { icon: "fa-history", label: "History", path: "/history" },
        { icon: "fa-money-bill", label: "Payments", path: "/payments" },
    ];

    const studentMenu = [
        { icon: "fa-qrcode", label: "Scan QR", path: "/" },
        { icon: "fa-history", label: "My Attendance", path: "/attendance" },
        { icon: "fa-wallet", label: "Payment", path: "/payment" },
    ];

    let isMobileMenuOpen = false;

    $: menu = $auth.user?.role === "ADMIN" ? adminMenu : studentMenu;

    function toggleMobileMenu() {
        isMobileMenuOpen = !isMobileMenuOpen;
    }

    function closeMobileMenu() {
        isMobileMenuOpen = false;
    }
</script>

<!-- Mobile Menu Button (visible on small screens) -->
<button
    on:click={toggleMobileMenu}
    class="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
>
    <i class="fas {isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl"></i>
</button>

<!-- Overlay for mobile -->
{#if isMobileMenuOpen}
    <div
        class="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30 backdrop-blur-sm"
        on:click={closeMobileMenu}
        on:keydown={(e) => e.key === "Escape" && closeMobileMenu()}
        role="button"
        tabindex="0"
    ></div>
{/if}

<!-- Sidebar -->
<aside
    class="fixed top-0 left-0 h-screen w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-40 transition-all duration-300 {isMobileMenuOpen
        ? 'translate-x-0'
        : '-translate-x-full lg:translate-x-0'} shadow-xl"
>
    <!-- Logo -->
    <div
        class="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800"
    >
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <i class="fas fa-graduation-cap text-2xl text-white"></i>
            </div>
            <span class="text-xl font-bold text-white">Attendance</span>
        </div>
    </div>

    <!-- Navigation -->
    <nav class="p-4 space-y-1.5 overflow-y-auto" style="height: calc(100vh - 144px);">
        {#each menu as item}
            <a
                href="#{item.path}"
                on:click={closeMobileMenu}
                class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group {$location ===
                item.path
                    ? 'bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}"
            >
                <div class="w-10 h-10 flex items-center justify-center rounded-lg {$location === item.path ? 'bg-primary-100 dark:bg-primary-800/50' : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'} transition-colors">
                    <i class="fas {item.icon} {$location === item.path ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'}"></i>
                </div>
                <span class="font-medium">{item.label}</span>
            </a>
        {/each}
    </nav>

    <!-- User Info (bottom) -->
    <div
        class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
    >
        <div class="flex items-center gap-3 mb-3">
            <div
                class="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-sm"
            >
                <i class="fas fa-user text-white"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {$auth.user?.name}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{$auth.user?.role}</p>
            </div>
        </div>
        
        <!-- Dark Mode Toggle -->
        <button
            on:click={() => theme.toggle()}
            class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium text-gray-700 dark:text-gray-200"
        >
            {#if $theme === 'dark'}
                <i class="fas fa-sun"></i>
                <span>Light Mode</span>
            {:else}
                <i class="fas fa-moon"></i>
                <span>Dark Mode</span>
            {/if}
        </button>
    </div>
</aside>
