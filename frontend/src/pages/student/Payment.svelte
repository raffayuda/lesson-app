<script>
    import Layout from "../../components/Layout.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { toastStore } from "../../stores/toast.js";
    import { onMount } from "svelte";

    let payments = [];
    let allPayments = []; // For filtering
    let loading = false;
    let submitting = false;
    let dataFetched = false; // Cache flag

    // Pagination
    let currentPage = 1;
    let limit = 5;
    let totalPages = 1;

    // Filters
    let filterStatus = "";
    let filterStartDate = "";
    let filterEndDate = "";

    let form = {
        amount: "",
        payerName: "",
        paymentDate: new Date().toISOString().split("T")[0],
        description: "",
        method: "", // Payment method
        proofImage: "",
    };

    let imagePreview = "";
    let fileInput;
    let filterTimeout; // Debouncing

    onMount(() => {
        // Lazy load: only fetch when needed
        fetchPayments();
    });

    async function fetchPayments() {
        // Skip if already fetched (cache)
        if (dataFetched) {
            applyFiltersAndPagination();
            return;
        }

        loading = true;
        try {
            const response = await fetch(`${API_URL}/payments`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });
            if (response.ok) {
                const result = await response.json();
                // Handle pagination response structure
                allPayments = result.data || result;
                dataFetched = true; // Mark as cached
                applyFiltersAndPagination();
            }
        } catch (error) {
            console.error("Error fetching payments:", error);
        } finally {
            loading = false;
        }
    }

    // Memoized filter function
    function applyFiltersAndPagination() {
        // Early return if no data
        if (!allPayments || allPayments.length === 0) {
            payments = [];
            totalPages = 1;
            return;
        }

        let filtered = allPayments;

        // Apply filters only if they exist (avoid unnecessary filtering)
        if (filterStatus) {
            filtered = filtered.filter((p) => p.status === filterStatus);
        }
        if (filterStartDate) {
            const startDate = new Date(filterStartDate);
            filtered = filtered.filter(
                (p) => new Date(p.paymentDate) >= startDate,
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
        totalPages = Math.ceil(filtered.length / limit) || 1;
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

    // Debounced filter application
    function debouncedFilter() {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
            currentPage = 1;
            applyFiltersAndPagination();
        }, 300); // 300ms debounce
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

    // Image compression function
    async function compressImage(file, maxSizeMB = 2, maxWidthOrHeight = 1200) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    let width = img.width;
                    let height = img.height;

                    // Resize if too large
                    if (width > height) {
                        if (width > maxWidthOrHeight) {
                            height *= maxWidthOrHeight / width;
                            width = maxWidthOrHeight;
                        }
                    } else {
                        if (height > maxWidthOrHeight) {
                            width *= maxWidthOrHeight / height;
                            height = maxWidthOrHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);

                    // Try different quality levels to meet size requirement
                    let quality = 0.8;
                    let compressedDataUrl = canvas.toDataURL(
                        "image/jpeg",
                        quality,
                    );

                    // Reduce quality if still too large
                    while (
                        compressedDataUrl.length >
                            maxSizeMB * 1024 * 1024 * 1.37 &&
                        quality > 0.1
                    ) {
                        quality -= 0.1;
                        compressedDataUrl = canvas.toDataURL(
                            "image/jpeg",
                            quality,
                        );
                    }

                    resolve(compressedDataUrl);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                // 2MB limit
                toastStore.error("File size must be less than 2MB");
                return;
            }

            if (!file.type.startsWith("image/")) {
                toastStore.error("Please upload an image file");
                return;
            }

            try {
                // Show loading state
                imagePreview = "loading";

                // Compress image
                const compressedImage = await compressImage(file, 2);
                form.proofImage = compressedImage;
                imagePreview = compressedImage;

                toastStore.success(
                    "Image uploaded and compressed successfully!",
                );
            } catch (error) {
                toastStore.error("Failed to process image: " + error.message);
                imagePreview = "";
            }
        }
    }

    async function handleSubmit() {
        if (
            !form.amount ||
            !form.payerName ||
            !form.paymentDate ||
            !form.description ||
            !form.method ||
            !form.proofImage
        ) {
            toastStore.warning(
                "Please fill all fields, select payment method, and upload proof image",
            );
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
                toastStore.success("Payment submitted successfully!");
                form = {
                    amount: "",
                    payerName: "",
                    paymentDate: new Date().toISOString().split("T")[0],
                    description: "",
                    method: "",
                    proofImage: "",
                };
                imagePreview = "";
                if (fileInput) fileInput.value = "";

                // Invalidate cache and refetch
                dataFetched = false;
                fetchPayments();
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Failed to submit payment");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
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
            PENDING: "Menunggu",
            APPROVED: "Disetujui",
            REJECTED: "Ditolak",
        };
        return labels[status] || status;
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
        }).format(amount);
    }

    // Reactive: re-apply filters when filter values change (debounced)
    $: if (filterStatus !== undefined || filterStartDate || filterEndDate) {
        debouncedFilter();
    }
</script>

<Layout activePage="/payment" title="Pembayaran">
    <div class="max-w-4xl mx-auto space-y-6">
        <!-- Payment Methods Section -->
        <div
            class="bg-white rounded-lg shadow p-6 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        >
            <h2 class="text-xl dark:text-white font-semibold mb-4 text-center">
                <i class="fas fa-university mr-2"></i>
                Informasi Pembayaran
            </h2>

            <div class="mb-4">
                <label
                    class="block text-sm font-medium dark:text-gray-300 mb-2"
                >
                    Pilih Metode Pembayaran
                </label>
                <select
                    bind:value={form.method}
                    class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500"
                >
                    <option value="">-- Pilih Metode --</option>
                    <option value="BCA">BCA</option>
                    <option value="BRI">BRI</option>
                    <option value="Gopay">Gopay</option>
                    <option value="Shopee Pay">Shopee Pay</option>
                    <option value="Dana">Dana</option>
                    <option value="OVO">OVO</option>
                </select>
            </div>

            {#if form.method}
                <div
                    class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
                >
                    <div class="text-center mb-3">
                        <i
                            class="fas fa-info-circle text-blue-600 dark:text-blue-400 text-2xl mb-2"
                        ></i>
                        <h3
                            class="font-semibold text-gray-900 dark:text-white text-lg"
                        >
                            {form.method}
                        </h3>
                    </div>

                    <div class="space-y-2">
                        <div
                            class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                        >
                            <p
                                class="text-xs text-gray-500 dark:text-gray-400 mb-1"
                            >
                                Nomor Rekening / Nomor HP
                            </p>
                            <p
                                class="text-lg font-mono font-bold text-gray-900 dark:text-white"
                            >
                                {#if form.method === "BCA"}
                                    8720364841
                                {:else if form.method === "BRI"}
                                    479801017707537
                                {:else if form.method === "Gopay" || form.method === "Shopee Pay" || form.method === "Dana" || form.method === "OVO"}
                                    081291256443
                                {/if}
                            </p>
                        </div>

                        <div
                            class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                        >
                            <p
                                class="text-xs text-gray-500 dark:text-gray-400 mb-1"
                            >
                                Atas Nama
                            </p>
                            <p
                                class="text-base font-semibold text-gray-900 dark:text-white"
                            >
                                DEWI NASTITI
                            </p>
                        </div>
                    </div>

                    <div class="mt-3 text-center">
                        <p class="text-xs text-blue-700 dark:text-blue-300">
                            <i class="fas fa-exclamation-circle mr-1"></i>
                            Pastikan transfer ke nomor rekening di atas
                        </p>
                    </div>
                </div>
            {:else}
                <div
                    class="text-center p-6 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                    <i
                        class="fas fa-hand-pointer text-4xl text-gray-300 dark:text-gray-600 mb-2"
                    ></i>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        Pilih metode pembayaran untuk melihat nomor rekening
                    </p>
                </div>
            {/if}
        </div>

        <!-- Payment Form -->
        <div
            class="bg-white rounded-lg shadow p-6 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        >
            <h3 class="text-lg dark:text-white font-semibold mb-4">
                <i class="fas fa-upload mr-2"></i>
                Kirim Bukti Pembayaran
            </h3>

            <form on:submit|preventDefault={handleSubmit} class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label
                            class="block text-sm font-medium dark:text-gray-300 mb-1"
                            >Jumlah (Rp)</label
                        >
                        <input
                            type="number"
                            bind:value={form.amount}
                            required
                            min="0"
                            step="1000"
                            class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500"
                            placeholder="50000"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-medium dark:text-gray-300 mb-1"
                            >Nama Pembayar</label
                        >
                        <input
                            type="text"
                            bind:value={form.payerName}
                            required
                            class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500"
                            placeholder="Nama Anda"
                        />
                    </div>
                </div>

                <div>
                    <label
                        class="block text-sm font-medium dark:text-gray-300 mb-1"
                        >Tanggal Pembayaran</label
                    >
                    <input
                        type="date"
                        bind:value={form.paymentDate}
                        required
                        class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500"
                    />
                </div>

                <div>
                    <label
                        class="block text-sm font-medium dark:text-gray-300 mb-1"
                        >Deskripsi</label
                    >
                    <textarea
                        bind:value={form.description}
                        required
                        rows="3"
                        class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500"
                        placeholder="Contoh: Bayar Les Bulan Juni"
                    ></textarea>
                </div>

                <div>
                    <label
                        class="block text-sm font-medium dark:text-gray-300 mb-1"
                        >Unggah Bukti Gambar</label
                    >
                    <input
                        type="file"
                        accept="image/*"
                        on:change={handleFileSelect}
                        bind:this={fileInput}
                        required
                        class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500"
                    />
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Max file size: 2MB. Supported: JPG, PNG (will be
                        compressed automatically)
                    </p>
                </div>

                {#if imagePreview}
                    <div>
                        <label
                            class="block text-sm font-medium dark:text-gray-300 mb-1"
                            >Pratinjau</label
                        >
                        {#if imagePreview === "loading"}
                            <div
                                class="flex items-center justify-center p-8 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700"
                            >
                                <i
                                    class="fas fa-spinner fa-spin text-3xl text-primary-500"
                                ></i>
                                <span
                                    class="ml-3 text-sm text-gray-600 dark:text-gray-300"
                                    >Mengompresi gambar...</span
                                >
                            </div>
                        {:else}
                            <img
                                src={imagePreview}
                                alt="Preview"
                                loading="lazy"
                                class="max-w-xs max-h-64 rounded-lg border border-gray-300 dark:border-gray-600 object-contain"
                            />
                        {/if}
                    </div>
                {/if}

                <button
                    type="submit"
                    disabled={submitting}
                    class="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                >
                    {#if submitting}
                        <i class="fas fa-spinner fa-spin mr-2"></i>
                        Mengirim...
                    {:else}
                        <i class="fas fa-paper-plane mr-2"></i>
                        Kirim Pembayaran
                    {/if}
                </button>
            </form>
        </div>

        <!-- Payment History -->
        <div
            class="bg-white rounded-lg shadow p-6 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        >
            <h3
                class="text-lg font-semibold text-gray-900 dark:text-gray-300 mb-4"
            >
                <i class="fas fa-history mr-2"></i>
                Riwayat Pembayaran Saya
            </h3>

            <!-- Filters -->
            <div class="mb-4 space-y-3">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label
                            class="block text-sm font-medium dark:text-gray-300 mb-1"
                            >Status</label
                        >
                        <select
                            bind:value={filterStatus}
                            class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500 text-sm"
                        >
                            <option value="">Semua Status</option>
                            <option value="PENDING">Menunggu</option>
                            <option value="APPROVED">Disetujui</option>
                            <option value="REJECTED">Ditolak</option>
                        </select>
                    </div>

                    <div>
                        <label
                            class="block text-sm font-medium dark:text-gray-300 mb-1"
                            >Tanggal Mulai</label
                        >
                        <input
                            type="date"
                            bind:value={filterStartDate}
                            class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500 text-sm"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-medium dark:text-gray-300 mb-1"
                            >Tanggal Akhir</label
                        >
                        <input
                            type="date"
                            bind:value={filterEndDate}
                            class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-500 text-sm"
                        />
                    </div>
                </div>

                {#if filterStatus || filterStartDate || filterEndDate}
                    <button
                        on:click={clearFilters}
                        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
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
                    <table
                        class="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
                    >
                        <thead class="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                    >Date</th
                                >
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                    >Amount</th
                                >
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                    >Method</th
                                >
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                    >Description</th
                                >
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                    >Status</th
                                >
                            </tr>
                        </thead>
                        <tbody
                            class="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700"
                        >
                            {#each payments as payment}
                                <tr
                                    class="hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    <td
                                        class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300"
                                    >
                                        {new Date(
                                            payment.paymentDate,
                                        ).toLocaleDateString()}
                                    </td>
                                    <td
                                        class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-300"
                                    >
                                        {formatCurrency(payment.amount)}
                                    </td>
                                    <td
                                        class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300"
                                    >
                                        <span
                                            class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                        >
                                            <i class="fas fa-university mr-1"
                                            ></i>
                                            {payment.method || "-"}
                                        </span>
                                    </td>
                                    <td
                                        class="px-4 py-3 text-sm text-gray-500 dark:text-gray-300"
                                    >
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
                                                alasan: {payment.rejectionReason}
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
                                            class="px-3 py-1 border rounded-lg text-sm dark:hover:bg-gray-700 {page ===
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
