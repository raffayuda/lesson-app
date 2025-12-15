<script>
    import { auth } from "../stores/auth.js";

    let email = "";
    let password = "";
    let error = "";
    let loading = false;

    async function handleSubmit() {
        error = "";
        loading = true;

        try {
            await auth.login(email, password);
            // Force page reload to ensure router updates properly
            window.location.href =
                window.location.origin + window.location.pathname + "#/";
            window.location.reload();
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    }
</script>

<div
    class="min-h-screen bg-gradient-to-br dark:from-primary-500 dark:to-blue-100 flex items-center justify-center p-4"
>
    <div class="w-full max-w-md">
        <!-- Logo -->
        <div class="text-center mb-8">
            <div
                class="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4"
            >
                <i class="fas fa-graduation-cap text-3xl text-white"></i>
            </div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Attendance System</h1>
            <p class="text-gray-600 dark:text-gray-300 mt-2">Sign in to your account</p>
        </div>

        <!-- Login Card -->
        <div class="bg-white rounded-2xl shadow-xl p-8 dark:bg-gray-800">
            {#if error}
                <div
                    class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
                >
                    <i class="fas fa-exclamation-circle text-red-500 mt-0.5"
                    ></i>
                    <p class="text-sm text-red-700">{error}</p>
                </div>
            {/if}

            <form on:submit|preventDefault={handleSubmit} class="space-y-6">
                <div>
                    <label
                        for="email"
                        class="block text-sm font-medium dark:text-gray-300 mb-2"
                    >
                        <i class="fas fa-envelope mr-2"></i>Email Address
                    </label>
                    <input
                        type="email"
                        id="email"
                        bind:value={email}
                        placeholder="Enter your email"
                        required
                        disabled={loading}
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500"
                    />
                </div>

                <div>
                    <label
                        for="password"
                        class="block text-sm font-medium dark:text-gray-300 mb-2"
                    >
                        <i class="fas fa-lock mr-2"></i>Password
                    </label>
                    <input
                        type="password"
                        id="password"
                        bind:value={password}
                        placeholder="Enter your password"
                        required
                        disabled={loading}
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500"
                    />
                </div>

                <div class="flex items-center justify-between text-sm">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span class="text-gray-600 dark:text-gray-300">Remember me</span>
                    </label>
                    <a
                        href="#/forgot-password"
                        class="text-primary-600 dark:text-primary-500 hover:text-primary-700 font-medium"
                    >
                        Forgot password?
                    </a>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    class="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {#if loading}
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Signing in...</span>
                    {:else}
                        <i class="fas fa-sign-in-alt"></i>
                        <span>Sign In</span>
                    {/if}
                </button>
            </form>

            <div class="mt-6 text-center text-sm text-gray-600">
                <p>
                    Default Admin: <strong>admin@attendance.com</strong> /
                    <strong>admin123</strong>
                </p>
            </div>
        </div>
    </div>
</div>
