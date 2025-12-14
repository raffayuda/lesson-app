<script>
    import Sidebar from "./Sidebar.svelte";
    import Navbar from "./Navbar.svelte";

    export let activePage = "/";
    export let title = "Dashboard";
</script>

<div class="min-h-screen bg-gray-50">
    <Sidebar {activePage} />
    <Navbar>
        <svelte:fragment slot="title">{title}</svelte:fragment>
    </Navbar>

    <main class="pt-16 lg:pl-64 min-h-screen">
        <div class="p-4 lg:p-6">
            <slot />
        </div>
    </main>
</div>
