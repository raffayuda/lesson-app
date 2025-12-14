<script>
    import { auth } from "../stores/auth.js";

    let showDropdown = false;

    function handleLogout() {
        if (confirm("Are you sure you want to logout?")) {
            auth.logout();
            // Force page reload to ensure router updates properly
            window.location.href =
                window.location.origin + window.location.pathname + "#/login";
            window.location.reload();
        }
    }

    function toggleDropdown() {
        showDropdown = !showDropdown;
    }
</script>

<nav
    class="h-16 bg-white border-b border-gray-200 fixed top-0 right-0 left-0 lg:left-64 z-20"
>
    <div class="h-full px-4 lg:px-6 flex items-center justify-between">
        <div class="flex-1 ml-12 lg:ml-0">
            <h2 class="text-lg lg:text-xl font-semibold text-gray-800 truncate">
                <slot name="title">Dashboard</slot>
            </h2>
        </div>

        <div class="flex items-center gap-2 lg:gap-4">
            <!-- Profile Dropdown -->
            <div class="relative">
                <button
                    on:click={toggleDropdown}
                    class="flex items-center gap-2 px-2 lg:px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <i
                        class="fas fa-user-circle text-xl lg:text-2xl text-gray-600"
                    ></i>
                    <i
                        class="fas fa-chevron-down text-xs text-gray-400 hidden lg:block"
                    ></i>
                </button>

                <!-- Dropdown Menu -->
                {#if showDropdown}
                    <div
                        class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                    >
                        <div class="p-3 border-b border-gray-100">
                            <p
                                class="text-sm font-medium text-gray-900 truncate"
                            >
                                {$auth.user?.name}
                            </p>
                            <p class="text-xs text-gray-500 truncate">
                                {$auth.user?.email}
                            </p>
                        </div>
                        <div class="p-2">
                            <a
                                href="#/profile"
                                on:click={() => (showDropdown = false)}
                                class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
                            >
                                <i class="fas fa-user-edit w-4"></i>
                                <span>Edit Profile</span>
                            </a>
                            <button
                                on:click={handleLogout}
                                class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
                            >
                                <i class="fas fa-sign-out-alt w-4"></i>
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</nav>

<!-- Click outside to close dropdown -->
{#if showDropdown}
    <div
        class="fixed inset-0 z-10"
        on:click={() => (showDropdown = false)}
        on:keydown={(e) => e.key === "Escape" && (showDropdown = false)}
        role="button"
        tabindex="0"
    ></div>
{/if}
