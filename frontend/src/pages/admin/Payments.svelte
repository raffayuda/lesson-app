<script>
    import Layout from "../../components/Layout.svelte";
    import Modal from "../../components/Modal.svelte";
    import LoadingOverlay from "../../components/LoadingOverlay.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { toastStore } from "../../stores/toast.js";
    import { onMount } from "svelte";
    import * as XLSX from "xlsx";

    let payments = [];
    let allPayments = []; // For stats calculation
    let students = [];
    let loading = true;
    let processing = false;
    let processingMessage = "Processing...";

    // Confirmation modal
    let showConfirmModal = false;
    let confirmModalConfig = {
        title: "",
        message: "",
        onConfirm: () => {},
        danger: false,
    };

    // Pagination
    let currentPage = 1;
    let limit = 10;
    let totalPages = 1;
    let totalPayments = 0;

    // Filters
    let filterStatus = "";
    let filterStudent = "";
    let filterStartDate = "";
    let filterEndDate = "";

    // Modals
    let showProofModal = false;
    let showRejectModal = false;
    let selectedPayment = null;
    let rejectionReason = "";

    onMount(() => {
        fetchData();
    });

    async function fetchData() {
        loading = true;
        try {
            const [paymentsRes, allPaymentsRes, studentsRes] =
                await Promise.all([
                    fetch(
                        `${API_URL}/payments?page=${currentPage}&limit=${limit}`,
                        {
                            headers: {
                                Authorization: `Bearer ${auth.getToken()}`,
                            },
                        },
                    ),
                    // Fetch all payments for stats (without pagination)
                    fetch(`${API_URL}/payments?limit=1000`, {
                        headers: { Authorization: `Bearer ${auth.getToken()}` },
                    }),
                    fetch(`${API_URL}/students`, {
                        headers: { Authorization: `Bearer ${auth.getToken()}` },
                    }),
                ]);

            if (paymentsRes.ok) {
                const result = await paymentsRes.json();
                payments = result.data || result;
                if (result.pagination) {
                    totalPages = result.pagination.totalPages;
                    totalPayments = result.pagination.total;
                    currentPage = result.pagination.page;
                }
            }
            if (allPaymentsRes.ok) {
                const allResult = await allPaymentsRes.json();
                allPayments = allResult.data || allResult;
            }
            if (studentsRes.ok) students = await studentsRes.json();
        } catch (error) {
            console.error("Error:", error);
        } finally {
            loading = false;
        }
    }

    async function applyFilters() {
        loading = true;
        try {
            const params = new URLSearchParams();
            params.append("page", currentPage.toString());
            params.append("limit", limit.toString());
            if (filterStatus) params.append("status", filterStatus);
            if (filterStudent) params.append("studentId", filterStudent);
            if (filterStartDate) params.append("startDate", filterStartDate);
            if (filterEndDate) params.append("endDate", filterEndDate);

            const response = await fetch(`${API_URL}/payments?${params}`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (response.ok) {
                const result = await response.json();
                payments = result.data || result;
                if (result.pagination) {
                    totalPages = result.pagination.totalPages;
                    totalPayments = result.pagination.total;
                    currentPage = result.pagination.page;
                }
            }
        } catch (error) {
            console.error("Error:", error);
        } finally {
            loading = false;
        }
    }

    function clearFilters() {
        filterStatus = "";
        filterStudent = "";
        filterStartDate = "";
        filterEndDate = "";
        currentPage = 1;
        fetchData();
    }

    function goToPage(page) {
        if (page >= 1 && page <= totalPages) {
            currentPage = page;
            applyFilters();
        }
    }

    function nextPage() {
        if (currentPage < totalPages) {
            currentPage++;
            applyFilters();
        }
    }

    function prevPage() {
        if (currentPage > 1) {
            currentPage--;
            applyFilters();
        }
    }

    function confirmApprovePayment(payment) {
        confirmModalConfig = {
            title: "Approve Payment",
            message: `Are you sure you want to approve payment from ${payment.student.user.name}?`,
            onConfirm: () => approvePayment(payment),
            danger: false,
        };
        showConfirmModal = true;
    }

    async function approvePayment(payment) {
        processing = true;
        processingMessage = "Approving payment...";
        try {
            const response = await fetch(
                `${API_URL}/payments/${payment.id}/approve`,
                {
                    method: "PUT",
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                },
            );

            if (response.ok) {
                toastStore.success("Payment approved successfully!");
                await fetchData();
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Failed to approve payment");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        } finally {
            processing = false;
        }
    }

    function openRejectModal(payment) {
        selectedPayment = payment;
        rejectionReason = "";
        showRejectModal = true;
    }

    async function rejectPayment() {
        if (!rejectionReason.trim()) {
            toastStore.warning("Please provide a rejection reason");
            return;
        }

        processing = true;
        processingMessage = "Rejecting payment...";
        try {
            const response = await fetch(
                `${API_URL}/payments/${selectedPayment.id}/reject`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${auth.getToken()}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ reason: rejectionReason }),
                },
            );

            if (response.ok) {
                toastStore.success("Payment rejected");
                showRejectModal = false;
                selectedPayment = null;
                rejectionReason = "";
                await fetchData();
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Failed to reject payment");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        } finally {
            processing = false;
        }
    }

    function confirmDeletePayment(payment) {
        confirmModalConfig = {
            title: "Delete Payment",
            message: `Delete payment from ${payment.student.user.name}? This action cannot be undone.`,
            onConfirm: () => deletePayment(payment),
            danger: true,
        };
        showConfirmModal = true;
    }

    async function deletePayment(payment) {
        processing = true;
        processingMessage = "Deleting payment...";
        try {
            const response = await fetch(`${API_URL}/payments/${payment.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (response.ok) {
                toastStore.success("Payment deleted");
                await fetchData();
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Failed to delete payment");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        } finally {
            processing = false;
        }
    }

    async function viewProof(payment) {
        selectedPayment = payment;
        showProofModal = true;

        // Lazy load proof image if not already loaded
        if (!payment.proofImage) {
            try {
                const response = await fetch(
                    `${API_URL}/payments/${payment.id}/proof`,
                    {
                        headers: { Authorization: `Bearer ${auth.getToken()}` },
                    },
                );
                if (response.ok) {
                    const data = await response.json();
                    payment.proofImage = data.proofImage;
                    selectedPayment = payment;
                }
            } catch (error) {
                console.error("Error loading proof:", error);
            }
        }
    }

    async function exportToExcel() {
        processing = true;
        processingMessage = "Exporting data to Excel...";

        try {
            // Build params with current filters to get ALL matching data
            const params = new URLSearchParams();
            params.append("limit", "10000"); // Get all data, not paginated

            // Apply current filters
            if (filterStatus) params.append("status", filterStatus);
            if (filterStudent) params.append("studentId", filterStudent);
            if (filterStartDate) params.append("startDate", filterStartDate);
            if (filterEndDate) params.append("endDate", filterEndDate);

            const response = await fetch(`${API_URL}/payments?${params}`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch data for export");
            }

            const result = await response.json();
            const exportData = result.data || result;

            // Map data for Excel
            const data = exportData.map((p) => ({
                Date: new Date(p.paymentDate).toLocaleDateString(),
                Student: p.student.user.name,
                "Student ID": p.student.studentId,
                "Payer Name": p.payerName,
                Amount: p.amount,
                Description: p.description,
                Status: p.status,
                "Approved By": p.approver?.name || "-",
                "Approved At": p.approvedAt
                    ? new Date(p.approvedAt).toLocaleString()
                    : "-",
                "Rejection Reason": p.rejectionReason || "-",
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);

            ws["!cols"] = [
                { wch: 12 },
                { wch: 20 },
                { wch: 12 },
                { wch: 20 },
                { wch: 15 },
                { wch: 30 },
                { wch: 10 },
                { wch: 15 },
                { wch: 18 },
                { wch: 30 },
            ];

            XLSX.utils.book_append_sheet(wb, ws, "Payments");
            const filename = `payments-${new Date().toISOString().split("T")[0]}.xlsx`;
            XLSX.writeFile(wb, filename);

            toastStore.success(
                `Exported ${data.length} payment records to Excel`,
            );
        } catch (error) {
            console.error("Export error:", error);
            toastStore.error("Failed to export data: " + error.message);
        } finally {
            processing = false;
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

    function formatCurrency(amount) {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
        }).format(amount);
    }

    $: stats = {
        total: allPayments.length,
        pending: allPayments.filter((p) => p.status === "PENDING").length,
        approved: allPayments.filter((p) => p.status === "APPROVED").length,
        rejected: allPayments.filter((p) => p.status === "REJECTED").length,
        totalAmount: allPayments
            .filter((p) => p.status === "APPROVED")
            .reduce((sum, p) => sum + p.amount, 0),
    };
</script>

<Layout activePage="/payments" title="Manajemen Pembayaran">
    <div class="space-y-6">
        <!-- Header -->
        <div
            class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                <i class="fas fa-money-bill mr-2"></i>
                Manajemen Pembayaran
            </h2>
            <button
                on:click={exportToExcel}
                class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
            >
                <i class="fas fa-file-excel"></i>
                <span>Ekspor Excel</span>
            </button>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div
                class="bg-white rounded-lg shadow p-4 text-center border-l-4 border-blue-500 dark:border-blue-400 dark:bg-gray-800"
            >
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.total}
                </p>
                <p class="text-xs text-gray-500 mt-1">Total</p>
            </div>
            <div
                class="bg-white rounded-lg shadow p-4 text-center border-l-4 border-yellow-500 dark:border-yellow-400 dark:bg-gray-800"
            >
                <p class="text-2xl font-bold text-yellow-600">
                    {stats.pending}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Menunggu
                </p>
            </div>
            <div
                class="bg-white rounded-lg shadow p-4 text-center border-l-4 border-green-500 dark:border-green-400 dark:bg-gray-800"
            >
                <p class="text-2xl font-bold text-green-600">
                    {stats.approved}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Disetujui
                </p>
            </div>
            <div
                class="bg-white rounded-lg shadow p-4 text-center border-l-4 border-red-500 dark:border-red-400 dark:bg-gray-800"
            >
                <p class="text-2xl font-bold text-red-600">{stats.rejected}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Ditolak
                </p>
            </div>
            <div
                class="bg-white rounded-lg shadow p-4 text-center border-l-4 border-blue-500 dark:border-blue-400 dark:bg-gray-800"
            >
                <p class="text-lg font-bold text-blue-600">
                    {formatCurrency(stats.totalAmount)}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Total Disetujui
                </p>
            </div>
        </div>

        <!-- Filters -->
        <div
            class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
        >
            <h3
                class="text-lg font-semibold text-gray-900 dark:text-white mb-4"
            >
                <i class="fas fa-filter mr-2 text-primary-600"></i>
                Filter
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Status</label
                    >
                    <select
                        bind:value={filterStatus}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="">Semua Status</option>
                        <option value="PENDING">Menunggu</option>
                        <option value="APPROVED">Disetujui</option>
                        <option value="REJECTED">Ditolak</option>
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Siswa</label
                    >
                    <select
                        bind:value={filterStudent}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="">Semua Siswa</option>
                        {#each students as student}
                            <option value={student.id}
                                >{student.user.name} ({student.studentId})</option
                            >
                        {/each}
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Tanggal Mulai</label
                    >
                    <input
                        type="date"
                        bind:value={filterStartDate}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Tanggal Akhir</label
                    >
                    <input
                        type="date"
                        bind:value={filterEndDate}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                </div>
            </div>

            <div class="flex gap-3 mt-4">
                <button
                    on:click={applyFilters}
                    class="px-4 py-2 bg-blue-700 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                    <i class="fas fa-search mr-2"></i>
                    Terapkan Filter
                </button>
                <button
                    on:click={clearFilters}
                    class="px-4 py-2 bg-red-700 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 text-white rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                    <i class="fas fa-times mr-2"></i>
                    Hapus Filter
                </button>
            </div>
        </div>

        <!-- Payments Table -->
        <div
            class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-x-auto border border-gray-200 dark:border-gray-700"
        >
            {#if loading}
                <div class="flex justify-center py-20">
                    <i class="fas fa-spinner fa-spin text-4xl text-primary-500"
                    ></i>
                </div>
            {:else if payments.length === 0}
                <div class="text-center py-20 text-gray-500 dark:text-gray-400">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>Tidak ada pembayaran ditemukan</p>
                </div>
            {:else}
                <table
                    class="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
                >
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                >Tanggal</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Siswa</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Jumlah</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Deskripsi</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Status</th
                            >
                            <th
                                class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                                >Aksi</th
                            >
                        </tr>
                    </thead>
                    <tbody
                        class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
                    >
                        {#each payments as payment}
                            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td
                                    class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white"
                                >
                                    {new Date(
                                        payment.paymentDate,
                                    ).toLocaleDateString()}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap">
                                    <div
                                        class="text-sm font-medium text-gray-900 dark:text-white"
                                    >
                                        {payment.student.user.name}
                                    </div>
                                </td>
                                <td
                                    class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    {formatCurrency(payment.amount)}
                                </td>
                                <td
                                    class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                                >
                                    {payment.description}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap">
                                    <span
                                        class="px-2 py-1 text-xs font-medium rounded-full {getStatusColor(
                                            payment.status,
                                        )}"
                                    >
                                        {payment.status}
                                    </span>
                                    {#if payment.approver}
                                        <p
                                            class="text-xs text-gray-500 dark:text-gray-400 mt-1"
                                        >
                                            oleh {payment.approver.name}
                                        </p>
                                    {/if}
                                </td>
                                <td
                                    class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2"
                                >
                                    <button
                                        on:click={() => viewProof(payment)}
                                        class="text-blue-600 hover:text-blue-900"
                                        title="Lihat Bukti"
                                    >
                                        <i class="fas fa-image"></i>
                                    </button>
                                    {#if payment.status === "PENDING"}
                                        <button
                                            on:click={() =>
                                                confirmApprovePayment(payment)}
                                            class="text-green-600 hover:text-green-900"
                                            title="Setujui"
                                        >
                                            <i class="fas fa-check"></i>
                                        </button>
                                        <button
                                            on:click={() =>
                                                openRejectModal(payment)}
                                            class="text-red-600 hover:text-red-900"
                                            title="Tolak"
                                        >
                                            <i class="fas fa-times"></i>
                                        </button>
                                    {/if}
                                    <button
                                        on:click={() =>
                                            confirmDeletePayment(payment)}
                                        class="text-gray-600 hover:text-gray-900"
                                        title="Delete"
                                    >
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>

                <!-- Pagination Controls -->
                {#if totalPages > 1}
                    <div
                        class="px-6 py-4 border-t border-gray-200 flex items-center justify-between"
                    >
                        <div class="text-sm text-gray-700 dark:text-gray-200">
                            Showing <span class="font-medium"
                                >{(currentPage - 1) * limit + 1}</span
                            >
                            to
                            <span class="font-medium"
                                >{Math.min(
                                    currentPage * limit,
                                    totalPayments,
                                )}</span
                            >
                            of <span class="font-medium">{totalPayments}</span> payments
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
                                    <span
                                        class="px-2 text-gray-500 dark:text-gray-400"
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
            {/if}
        </div>
    </div>
</Layout>

<!-- Proof Image Modal -->
{#if showProofModal && selectedPayment}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        on:click={() => (showProofModal = false)}
        on:keydown={(e) => e.key === "Escape" && (showProofModal = false)}
        role="button"
        tabindex="0"
    >
        <div
            class="bg-white rounded-lg max-w-3xl w-full p-6"
            on:click|stopPropagation
            role="dialog"
            tabindex="-1"
        >
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                    Payment Proof
                </h3>
                <button
                    on:click={() => (showProofModal = false)}
                    class="text-gray-400 hover:text-gray-600"
                >
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>

            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p class="text-gray-500 dark:text-gray-400">Student</p>
                        <p class="font-medium">
                            {selectedPayment.student.user.name}
                        </p>
                    </div>
                    <div>
                        <p class="text-gray-500 dark:text-gray-400">Amount</p>
                        <p class="font-medium">
                            {formatCurrency(selectedPayment.amount)}
                        </p>
                    </div>
                    <div>
                        <p class="text-gray-500 dark:text-gray-400">
                            Payer Name
                        </p>
                        <p class="font-medium">{selectedPayment.payerName}</p>
                    </div>
                    <div>
                        <p class="text-gray-500 dark:text-gray-400">
                            Payment Date
                        </p>
                        <p class="font-medium">
                            {new Date(
                                selectedPayment.paymentDate,
                            ).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div>
                    <p class="text-gray-500 text-sm mb-1">Description</p>
                    <p class="text-sm">{selectedPayment.description}</p>
                </div>

                <div>
                    <p class="text-gray-500 text-sm mb-2">Proof Image</p>
                    <img
                        src={selectedPayment.proofImage}
                        alt="Payment Proof"
                        class="w-full rounded-lg border border-gray-300"
                    />
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Reject Modal -->
{#if showRejectModal && selectedPayment}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
        <div class="bg-white rounded-lg max-w-md w-full p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-4">
                Reject Payment
            </h3>

            <p class="text-sm text-gray-600 mb-4">
                Rejecting payment from <strong
                    >{selectedPayment.student.user.name}</strong
                >
            </p>

            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1"
                    >Rejection Reason</label
                >
                <textarea
                    bind:value={rejectionReason}
                    rows="3"
                    required
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Please provide a reason for rejection..."
                ></textarea>
            </div>

            <div class="flex gap-3 justify-end">
                <button
                    on:click={() => {
                        showRejectModal = false;
                        selectedPayment = null;
                        rejectionReason = "";
                    }}
                    class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg"
                >
                    Cancel
                </button>
                <button
                    on:click={rejectPayment}
                    class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                    <i class="fas fa-times mr-2"></i>
                    Reject Payment
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Confirmation Modal -->
<Modal
    bind:show={showConfirmModal}
    title={confirmModalConfig.title}
    message={confirmModalConfig.message}
    danger={confirmModalConfig.danger}
    on:confirm={confirmModalConfig.onConfirm}
/>

<!-- Loading Overlay -->
<LoadingOverlay show={processing} message={processingMessage} />
