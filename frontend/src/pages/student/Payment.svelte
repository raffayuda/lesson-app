<script>
    import Layout from "../../components/Layout.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { onMount } from "svelte";

    let payments = [];
    let allPayments = []; // For filtering
    let loading = false;
    let submitting = false;

    // Pagination
    let currentPage = 1;
    let limit = 5;
    let totalPages = 1;

    // Filters
    let filterStatus = "";
    let filterStartDate = "";
    let filterEndDate = "";

    // Form data
    let form = {
        amount: "",
        payerName: "",
        paymentDate: new Date().toISOString().split("T")[0],
        description: "",
        proofImage: "",
    };

    let imagePreview = "";
    let fileInput;

    onMount(() => {
        fetchPayments();
    });

    async function fetchPayments() {
        loading = true;
        try {
            const response = await fetch(`${API_URL}/payments`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });
            if (response.ok) {
                const result = await response.json();
                // Handle pagination response structure
                allPayments = result.data || result;
                applyFiltersAndPagination();
            }
        } catch (error) {
            console.error("Error fetching payments:", error);
        } finally {
            loading = false;
        }
    }

    function applyFiltersAndPagination() {
        let filtered = [...allPayments];

        // Apply filters
        if (filterStatus) {
            filtered = filtered.filter((p) => p.status === filterStatus);
        }
        if (filterStartDate) {
            filtered = filtered.filter(
                (p) => new Date(p.paymentDate) >= new Date(filterStartDate),
            );
        }
        if (filterEndDate) {
            const endDate = new Date(filterEndDate);
            endDate.setHours(23, 59, 59);
            filtered = filtered.filter(
                (p) => new Date(p.paymentDate) <= endDate,
            );
        }

        // Calculate pagination
        totalPages = Math.ceil(filtered.length / limit);
        const start = (currentPage - 1) * limit;
        const end = start + limit;
        payments = filtered.slice(start, end);
    }

    function clearFilters() {
        filterStatus = "";
        filterStartDate = "";
        filterEndDate = "";
        currentPage = 1;
        applyFiltersAndPagination();
    }

    function goToPage(page) {
        if (page >= 1 && page <= totalPages) {
            currentPage = page;
            applyFiltersAndPagination();
        }
    }

    function nextPage() {
        if (currentPage < totalPages) {
            currentPage++;
            applyFiltersAndPagination();
        }
    }

    function prevPage() {
        if (currentPage > 1) {
            currentPage--;
            applyFiltersAndPagination();
        }
    }

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                // 5MB limit
                alert("File size must be less than 5MB");
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                form.proofImage = e.target.result; // Base64
                imagePreview = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    async function handleSubmit() {
        if (
            !form.amount ||
            !form.payerName ||
            !form.paymentDate ||
            !form.description ||
            !form.proofImage
        ) {
            alert("Please fill all fields and upload proof image");
            return;
        }

        submitting = true;
        try {
            const response = await fetch(`${API_URL}/payments`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${auth.getToken()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(form),
            });

            if (response.ok) {
                alert("Payment submitted successfully!");
                // Reset form
                form = {
                    amount: "",
                    payerName: "",
                    paymentDate: new Date().toISOString().split("T")[0],
                    description: "",
                    proofImage: "",
                };
                imagePreview = "";
                if (fileInput) fileInput.value = "";
                fetchPayments();
            } else {
                const data = await response.json();
                alert(data.error || "Failed to submit payment");
            }
        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            submitting = false;
        }
    }

    function getStatusColor(status) {
        const colors = {
            PENDING: "bg-yellow-100 text-yellow-800",
            APPROVED: "bg-green-100 text-green-800",
            REJECTED: "bg-red-100 text-red-800",
        };
        return colors[status] || "bg-gray-100 text-gray-800";
    }

    function getStatusLabel(status) {
        const labels = {
            PENDING: "Pending",
            APPROVED: "Approved",
            REJECTED: "Rejected",
        };
        return labels[status] || status;
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
        }).format(amount);
    }

    // Reactive: re-apply filters when filter values change
    $: if (filterStatus || filterStartDate || filterEndDate) {
        currentPage = 1;
        applyFiltersAndPagination();
    }
</script>

<Layout activePage="/payment" title="Payment">
    <div class="max-w-4xl mx-auto space-y-6">
        <!-- QR Code Section -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4 text-center">
                <i class="fas fa-qrcode mr-2"></i>
                Scan to Pay
            </h2>
            <div class="flex justify-center mb-4">
                <img
                    src="/gopay-qr.png"
                    alt="GoPay QR Code"
                    class="w-64 h-64 rounded-lg shadow-md"
                />
            </div>
            <div
                class="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg"
            >
                <i class="fas fa-info-circle text-blue-600 mr-2"></i>
                <span class="text-sm text-blue-700"
                    >Scan QR code above with GoPay app to make payment</span
                >
            </div>
        </div>

        <!-- Payment Form -->
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
                <i class="fas fa-upload mr-2"></i>
                Submit Payment Proof
            </h3>

            <form on:submit|preventDefault={handleSubmit} class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >Amount (Rp)</label
                        >
                        <input
                            type="number"
                            bind:value={form.amount}
                            required
                            min="0"
                            step="1000"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            placeholder="50000"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >Payer Name</label
                        >
                        <input
                            type="text"
                            bind:value={form.payerName}
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            placeholder="Your name"
                        />
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Payment Date</label
                    >
                    <input
                        type="date"
                        bind:value={form.paymentDate}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Description</label
                    >
                    <textarea
                        bind:value={form.description}
                        required
                        rows="3"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="e.g., Monthly tuition fee - January 2025"
                    ></textarea>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Upload Proof Image</label
                    >
                    <input
                        type="file"
                        accept="image/*"
                        on:change={handleFileSelect}
                        bind:this={fileInput}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                    <p class="text-xs text-gray-500 mt-1">
                        Max file size: 5MB. Supported: JPG, PNG
                    </p>
                </div>

                {#if imagePreview}
                    <div>
                        <label
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >Preview</label
                        >
                        <img
                            src={imagePreview}
                            alt="Preview"
                            class="max-w-xs rounded-lg border border-gray-300"
                        />
                    </div>
                {/if}

                <button
                    type="submit"
                    disabled={submitting}
                    class="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                >
                    {#if submitting}
                        <i class="fas fa-spinner fa-spin mr-2"></i>
                        Submitting...
                    {:else}
                        <i class="fas fa-paper-plane mr-2"></i>
                        Submit Payment
                    {/if}
                </button>
            </form>
        </div>

        <!-- Payment History -->
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
                <i class="fas fa-history mr-2"></i>
                My Payment History
            </h3>

            <!-- Filters -->
            <div class="mb-4 space-y-3">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >Status</label
                        >
                        <select
                            bind:value={filterStatus}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                        >
                            <option value="">All Status</option>
                            <option value="PENDING">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>

                    <div>
                        <label
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >Start Date</label
                        >
                        <input
                            type="date"
                            bind:value={filterStartDate}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >End Date</label
                        >
                        <input
                            type="date"
                            bind:value={filterEndDate}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                    </div>
                </div>

                {#if filterStatus || filterStartDate || filterEndDate}
                    <button
                        on:click={clearFilters}
                        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                    >
                        <i class="fas fa-times mr-1"></i>
                        Clear Filters
                    </button>
                {/if}
            </div>

            {#if loading}
                <div class="flex justify-center py-8">
                    <i class="fas fa-spinner fa-spin text-3xl text-primary-500"
                    ></i>
                </div>
            {:else if payments.length === 0}
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>No payment history yet</p>
                </div>
            {:else}
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                    >Date</th
                                >
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                    >Amount</th
                                >
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                    >Description</th
                                >
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                    >Status</th
                                >
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            {#each payments as payment}
                                <tr class="hover:bg-gray-50">
                                    <td
                                        class="px-4 py-3 whitespace-nowrap text-sm text-gray-900"
                                    >
                                        {new Date(
                                            payment.paymentDate,
                                        ).toLocaleDateString()}
                                    </td>
                                    <td
                                        class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900"
                                    >
                                        {formatCurrency(payment.amount)}
                                    </td>
                                    <td class="px-4 py-3 text-sm text-gray-500">
                                        {payment.description}
                                    </td>
                                    <td class="px-4 py-3 whitespace-nowrap">
                                        <span
                                            class="px-2 py-1 text-xs font-medium rounded-full {getStatusColor(
                                                payment.status,
                                            )}"
                                        >
                                            {getStatusLabel(payment.status)}
                                        </span>
                                        {#if payment.status === "REJECTED" && payment.rejectionReason}
                                            <p
                                                class="text-xs text-red-600 mt-1"
                                            >
                                                Reason: {payment.rejectionReason}
                                            </p>
                                        {/if}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>

                    <!-- Pagination -->
                    {#if totalPages > 1}
                        <div
                            class="px-4 py-3 border-t border-gray-200 flex items-center justify-between"
                        >
                            <div class="text-sm text-gray-700">
                                Page <span class="font-medium"
                                    >{currentPage}</span
                                >
                                of <span class="font-medium">{totalPages}</span>
                            </div>

                            <div class="flex items-center gap-2">
                                <button
                                    on:click={prevPage}
                                    disabled={currentPage === 1}
                                    class="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                >
                                    <i class="fas fa-chevron-left"></i>
                                </button>

                                {#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
                                    {#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
                                        <button
                                            on:click={() => goToPage(page)}
                                            class="px-3 py-1 border rounded-lg text-sm {page ===
                                            currentPage
                                                ? 'bg-primary-600 text-white border-primary-600'
                                                : 'border-gray-300 hover:bg-gray-50'}"
                                        >
                                            {page}
                                        </button>
                                    {:else if page === currentPage - 2 || page === currentPage + 2}
                                        <span class="px-2 text-gray-500"
                                            >...</span
                                        >
                                    {/if}
                                {/each}

                                <button
                                    on:click={nextPage}
                                    disabled={currentPage === totalPages}
                                    class="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                >
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</Layout>
