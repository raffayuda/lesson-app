<script>
    import { auth } from "../stores/auth.js";
    import { location } from "svelte-spa-router";

    export let activePage = "/";

    const adminMenu = [
        { icon: "fa-chart-line", label: "Dashboard", path: "/" },
        { icon: "fa-calendar-alt", label: "Schedules", path: "/schedules" },
        { icon: "fa-users", label: "Students", path: "/students" },
        { icon: "fa-history", label: "History", path: "/history" },
    ];

    const studentMenu = [
        { icon: "fa-qrcode", label: "Scan QR", path: "/" },
        { icon: "fa-history", label: "My Attendance", path: "/attendance" },
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
    class="lg:hidden fixed top-4 left-4 z-50 p-2 bg-primary-600 text-white rounded-lg shadow-lg"
>
    <i class="fas {isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl"></i>
</button>

<!-- Overlay for mobile -->
{#if isMobileMenuOpen}
    <div
        class="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
        on:click={closeMobileMenu}
        on:keydown={(e) => e.key === "Escape" && closeMobileMenu()}
        role="button"
        tabindex="0"
    ></div>
{/if}

<!-- Sidebar -->
<aside
    class="fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 z-40 transition-transform duration-300 {isMobileMenuOpen
        ? 'translate-x-0'
        : '-translate-x-full lg:translate-x-0'}"
>
    <!-- Logo -->
    <div
        class="h-16 flex items-center justify-center border-b border-gray-200 bg-primary-600"
    >
        <div class="flex items-center gap-2">
            <i class="fas fa-graduation-cap text-2xl text-white"></i>
            <span class="text-xl font-bold text-white">Attendance</span>
        </div>
    </div>

    <!-- Navigation -->
    <nav class="p-4 space-y-2">
        {#each menu as item}
            <a
                href="#{item.path}"
                on:click={closeMobileMenu}
                class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors {$location ===
                item.path
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-700 hover:bg-gray-50'}"
            >
                <i class="fas {item.icon} w-5"></i>
                <span class="font-medium">{item.label}</span>
            </a>
        {/each}
    </nav>

    <!-- User Info (bottom) -->
    <div
        class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50"
    >
        <div class="flex items-center gap-3">
            <div
                class="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center"
            >
                <i class="fas fa-user text-primary-600"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">
                    {$auth.user?.name}
                </p>
                <p class="text-xs text-gray-500 truncate">{$auth.user?.role}</p>
            </div>
        </div>
    </div>
</aside>
