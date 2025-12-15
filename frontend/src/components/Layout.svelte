<script>
    import Sidebar from "./Sidebar.svelte";
    import Navbar from "./Navbar.svelte";
    import Toast from "./Toast.svelte";
    import { theme } from "../stores/theme.js";

    export let activePage = "/";
    export let title = "Dashboard";
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
    <Sidebar {activePage} />
    <Navbar>
        <svelte:fragment slot="title">{title}</svelte:fragment>
    </Navbar>

    <main class="pt-16 lg:pl-64 min-h-screen">
        <div class="p-4 lg:p-6">
            <slot />
        </div>
    </main>
    
    <!-- Global Toast Notifications -->
    <Toast />
</div>
