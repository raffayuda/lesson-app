<script>
    import Layout from "../components/Layout.svelte";
    import { auth, API_URL } from "../stores/auth.js";

    let form = {
        name: $auth.user?.name || "",
        email: $auth.user?.email || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    };

    let loading = false;
    let message = "";
    let error = "";

    async function handleUpdateProfile() {
        error = "";
        message = "";
        loading = true;

        try {
            const updateData = {
                name: form.name,
                email: form.email,
            };

            if (form.newPassword) {
                if (form.newPassword !== form.confirmPassword) {
                    error = "New passwords do not match";
                    loading = false;
                    return;
                }
                updateData.currentPassword = form.currentPassword;
                updateData.newPassword = form.newPassword;
            }

            const response = await fetch(`${API_URL}/auth/profile`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${auth.getToken()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(updateData),
            });

            const data = await response.json();

            if (response.ok) {
                // Update auth store
                auth.updateUser(data);
                message = "Profile updated successfully!";
                form.currentPassword = "";
                form.newPassword = "";
                form.confirmPassword = "";
            } else {
                error = data.error || "Failed to update profile";
            }
        } catch (err) {
            error = "Error: " + err.message;
        } finally {
            loading = false;
        }
    }
</script>

<Layout activePage="/profile" title="Profile Settings">
    <div class="max-w-2xl mx-auto space-y-6">
        <div class="bg-white rounded-lg shadow p-6 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h2 class="text-xl font-semibold dark:text-gray-100 mb-6">
                <i class="fas fa-user-circle mr-2"></i>
                Update Profile
            </h2>

            {#if message}
                <div
                    class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3"
                >
                    <i class="fas fa-check-circle text-green-500"></i>
                    <p class="text-sm text-green-700">{message}</p>
                </div>
            {/if}

            {#if error}
                <div
                    class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
                >
                    <i class="fas fa-exclamation-circle text-red-500"></i>
                    <p class="text-sm text-red-700">{error}</p>
                </div>
            {/if}

            <form
                on:submit|preventDefault={handleUpdateProfile}
                class="space-y-6"
            >
                <div class="space-y-4">
                    <h3 class="text-sm font-semibold dark:text-gray-300 uppercase">
                        Informasi Dasar
                    </h3>

                    <div>
                        <label
                            class="block text-sm font-medium dark:text-gray-300 mb-2"
                            >Nama</label
                        >
                        <input
                            bind:value={form.name}
                            required
                            disabled={loading}
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-medium dark:text-gray-300 mb-2"
                            >Email</label
                        >
                        <input
                            type="email"
                            bind:value={form.email}
                            required
                            disabled={loading}
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-medium dark:text-gray-300 mb-2"
                            >Peran</label
                        >
                        <input
                            value={$auth.user?.role}
                            disabled
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 capitalize dark:bg-gray-700 dark:border-gray-600"
                        />
                    </div>
                </div>

                <div class="border-t border-gray-200 pt-6 space-y-4">
                    <h3 class="text-sm font-semibold dark:text-gray-300 uppercase">
                        Ubah Kata Sandi (Opsional)
                    </h3>

                    <div>
                        <label
                            class="block text-sm font-medium dark:text-gray-300 mb-2"
                            >Kata Sandi Saat Ini</label
                        >
                        <input
                            type="password"
                            bind:value={form.currentPassword}
                            disabled={loading}
                            placeholder="Enter current password"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-medium dark:text-gray-300 mb-2"
                            >Kata Sandi Baru</label
                        >
                        <input
                            type="password"
                            bind:value={form.newPassword}
                            disabled={loading}
                            placeholder="Enter new password"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-medium dark:text-gray-300 mb-2"
                            >Konfirmasi Kata Sandi Baru</label
                        >
                        <input
                            type="password"
                            bind:value={form.confirmPassword}
                            disabled={loading}
                            placeholder="Confirm new password"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500"
                        />
                    </div>
                </div>

                <div class="flex gap-3 justify-end pt-4">
                    <a
                        href="#/"
                        class="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
                    >
                        Batal
                    </a>
                    <button
                        type="submit"
                        disabled={loading}
                        class="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                    >
                        {#if loading}
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Saving...</span>
                        {:else}
                            <i class="fas fa-save"></i>
                            <span>Save Changes</span>
                        {/if}
                    </button>
                </div>
            </form>
        </div>
    </div>
</Layout>
