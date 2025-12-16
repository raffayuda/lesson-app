<script>
    import Modal from "./Modal.svelte";
    import { auth } from "../stores/auth.js";
    import { theme } from "../stores/theme.js";

    let showDropdown = false;
    let showLogoutModal = false;

    function confirmLogout() {
        showLogoutModal = true;
    }

    function handleLogout() {
        auth.logout();
        // Force page reload to ensure router updates properly
        window.location.href =
            window.location.origin + window.location.pathname + "#/login";
        window.location.reload();
    }

    function toggleDropdown() {
        showDropdown = !showDropdown;
    }
</script>

<nav
    class="h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 fixed top-0 right-0 left-0 lg:left-64 z-20 shadow-sm"
>
    <div class="h-full px-4 lg:px-6 flex items-center justify-between">
        <div class="flex-1 ml-12 lg:ml-0">
            <h2
                class="text-lg lg:text-xl font-bold text-gray-900 dark:text-white truncate"
            >
                <slot name="title">Dasbor</slot>
            </h2>
        </div>

        <div class="flex items-center gap-2 lg:gap-4">
            <!-- Dark Mode Toggle (Desktop) -->
            <button
                on:click={() => theme.toggle()}
                class="hidden lg:flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-600 dark:text-gray-300"
                title="Toggle theme"
            >
                {#if $theme === "dark"}
                    <i class="fas fa-sun"></i>
                {:else}
                    <i class="fas fa-moon"></i>
                {/if}
            </button>

            <!-- Profile Dropdown -->
            <div class="relative">
                <button
                    on:click={toggleDropdown}
                    class="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    <div
                        class="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-sm"
                    >
                        <i class="fas fa-user text-white text-sm"></i>
                    </div>
                    <i
                        class="fas fa-chevron-down text-xs text-gray-400 dark:text-gray-500 hidden lg:block"
                    ></i>
                </button>

                <!-- Dropdown Menu -->
                {#if showDropdown}
                    <div
                        class="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
                    >
                        <div
                            class="p-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-gray-700 dark:to-gray-800"
                        >
                            <p
                                class="text-sm font-semibold text-gray-900 dark:text-white truncate"
                            >
                                {$auth.user?.name}
                            </p>
                            <p
                                class="text-xs text-gray-500 dark:text-gray-400 truncate"
                            >
                                {$auth.user?.email}
                            </p>
                        </div>
                        <div class="p-2">
                            <a
                                href="#/profile"
                                on:click={() => (showDropdown = false)}
                                class="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <i
                                    class="fas fa-user-edit w-4 text-gray-500 dark:text-gray-400"
                                ></i>
                                <span>Ubah Profil</span>
                            </a>
                            <button
                                on:click={confirmLogout}
                                class="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                                <i class="fas fa-sign-out-alt w-4"></i>
                                <span>Keluar</span>
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

<!-- Logout Confirmation Modal -->
<Modal
    bind:show={showLogoutModal}
    title="Keluar"
    message="Apakah Anda yakin ingin keluar?"
    danger={true}
    on:confirm={handleLogout}
/>
