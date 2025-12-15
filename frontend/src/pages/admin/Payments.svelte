<script>
    import Layout from "../../components/Layout.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { onMount } from "svelte";
    import * as XLSX from "xlsx";

    let payments = [];
    let students = [];
    let loading = true;

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
            const [paymentsRes, studentsRes] = await Promise.all([
                fetch(`${API_URL}/payments`, {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                }),
                fetch(`${API_URL}/students`, {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                }),
            ]);

            if (paymentsRes.ok) payments = await paymentsRes.json();
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
            if (filterStatus) params.append("status", filterStatus);
            if (filterStudent) params.append("studentId", filterStudent);
            if (filterStartDate) params.append("startDate", filterStartDate);
            if (filterEndDate) params.append("endDate", filterEndDate);

            const response = await fetch(`${API_URL}/payments?${params}`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (response.ok) {
                payments = await response.json();
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
        fetchData();
    }

    async function approvePayment(payment) {
        if (!confirm(`Approve payment from ${payment.student.user.name}?`))
            return;

        try {
            const response = await fetch(
                `${API_URL}/payments/${payment.id}/approve`,
                {
                    method: "PUT",
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                },
            );

            if (response.ok) {
                alert("Payment approved successfully!");
                fetchData();
            } else {
                const data = await response.json();
                alert(data.error || "Failed to approve payment");
            }
        } catch (error) {
            alert("Error: " + error.message);
        }
    }

    function openRejectModal(payment) {
        selectedPayment = payment;
        rejectionReason = "";
        showRejectModal = true;
    }

    async function rejectPayment() {
        if (!rejectionReason.trim()) {
            alert("Please provide a rejection reason");
            return;
        }

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
                alert("Payment rejected");
                showRejectModal = false;
                selectedPayment = null;
                rejectionReason = "";
                fetchData();
            } else {
                const data = await response.json();
                alert(data.error || "Failed to reject payment");
            }
        } catch (error) {
            alert("Error: " + error.message);
        }
    }

    async function deletePayment(payment) {
        if (
            !confirm(
                `Delete payment from ${payment.student.user.name}? This cannot be undone.`,
            )
        )
            return;

        try {
            const response = await fetch(`${API_URL}/payments/${payment.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (response.ok) {
                alert("Payment deleted");
                fetchData();
            } else {
                const data = await response.json();
                alert(data.error || "Failed to delete payment");
            }
        } catch (error) {
            alert("Error: " + error.message);
        }
    }

    function viewProof(payment) {
        selectedPayment = payment;
        showProofModal = true;
    }

    function exportToExcel() {
        const data = payments.map((p) => ({
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
        total: payments.length,
        pending: payments.filter((p) => p.status === "PENDING").length,
        approved: payments.filter((p) => p.status === "APPROVED").length,
        rejected: payments.filter((p) => p.status === "REJECTED").length,
        totalAmount: payments
            .filter((p) => p.status === "APPROVED")
            .reduce((sum, p) => sum + p.amount, 0),
    };
</script>

<Layout activePage="/payments" title="Payment Management">
    <div class="space-y-6">
        <!-- Header -->
        <div
            class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
            <h2 class="text-2xl font-bold text-gray-900">
                <i class="fas fa-money-bill mr-2"></i>
                Payment Management
            </h2>
            <button
                on:click={exportToExcel}
                class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
            >
                <i class="fas fa-file-excel"></i>
                <span>Export Excel</span>
            </button>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div class="bg-white rounded-lg shadow p-4 text-center">
                <p class="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p class="text-xs text-gray-500 mt-1">Total</p>
            </div>
            <div
                class="bg-white rounded-lg shadow p-4 text-center border-l-4 border-yellow-500"
            >
                <p class="text-2xl font-bold text-yellow-600">
                    {stats.pending}
                </p>
                <p class="text-xs text-gray-500 mt-1">Pending</p>
            </div>
            <div
                class="bg-white rounded-lg shadow p-4 text-center border-l-4 border-green-500"
            >
                <p class="text-2xl font-bold text-green-600">
                    {stats.approved}
                </p>
                <p class="text-xs text-gray-500 mt-1">Approved</p>
            </div>
            <div
                class="bg-white rounded-lg shadow p-4 text-center border-l-4 border-red-500"
            >
                <p class="text-2xl font-bold text-red-600">{stats.rejected}</p>
                <p class="text-xs text-gray-500 mt-1">Rejected</p>
            </div>
            <div
                class="bg-white rounded-lg shadow p-4 text-center border-l-4 border-blue-500"
            >
                <p class="text-lg font-bold text-blue-600">
                    {formatCurrency(stats.totalAmount)}
                </p>
                <p class="text-xs text-gray-500 mt-1">Total Approved</p>
            </div>
        </div>

        <!-- Filters -->
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
                <i class="fas fa-filter mr-2"></i>
                Filters
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
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
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Student</label
                    >
                    <select
                        bind:value={filterStudent}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    >
                        <option value="">All Students</option>
                        {#each students as student}
                            <option value={student.id}
                                >{student.user.name} ({student.studentId})</option
                            >
                        {/each}
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Start Date</label
                    >
                    <input
                        type="date"
                        bind:value={filterStartDate}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >End Date</label
                    >
                    <input
                        type="date"
                        bind:value={filterEndDate}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                </div>
            </div>

            <div class="flex gap-3 mt-4">
                <button
                    on:click={applyFilters}
                    class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm"
                >
                    <i class="fas fa-search mr-2"></i>
                    Apply Filters
                </button>
                <button
                    on:click={clearFilters}
                    class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                >
                    <i class="fas fa-times mr-2"></i>
                    Clear
                </button>
            </div>
        </div>

        <!-- Payments Table -->
        <div class="bg-white rounded-lg shadow overflow-x-auto">
            {#if loading}
                <div class="flex justify-center py-20">
                    <i class="fas fa-spinner fa-spin text-4xl text-primary-500"
                    ></i>
                </div>
            {:else if payments.length === 0}
                <div class="text-center py-20 text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>No payments found</p>
                </div>
            {:else}
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Date</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Student</th
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
                            <th
                                class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                                >Actions</th
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
                                <td class="px-4 py-3 whitespace-nowrap">
                                    <div
                                        class="text-sm font-medium text-gray-900"
                                    >
                                        {payment.student.user.name}
                                    </div>
                                    <div class="text-xs text-gray-500">
                                        ID: {payment.student.studentId}
                                    </div>
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
                                        {payment.status}
                                    </span>
                                    {#if payment.approver}
                                        <p class="text-xs text-gray-500 mt-1">
                                            by {payment.approver.name}
                                        </p>
                                    {/if}
                                </td>
                                <td
                                    class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2"
                                >
                                    <button
                                        on:click={() => viewProof(payment)}
                                        class="text-blue-600 hover:text-blue-900"
                                        title="View Proof"
                                    >
                                        <i class="fas fa-image"></i>
                                    </button>
                                    {#if payment.status === "PENDING"}
                                        <button
                                            on:click={() =>
                                                approvePayment(payment)}
                                            class="text-green-600 hover:text-green-900"
                                            title="Approve"
                                        >
                                            <i class="fas fa-check"></i>
                                        </button>
                                        <button
                                            on:click={() =>
                                                openRejectModal(payment)}
                                            class="text-red-600 hover:text-red-900"
                                            title="Reject"
                                        >
                                            <i class="fas fa-times"></i>
                                        </button>
                                    {/if}
                                    <button
                                        on:click={() => deletePayment(payment)}
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
                <h3 class="text-xl font-semibold text-gray-900">
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
                        <p class="text-gray-500">Student</p>
                        <p class="font-medium">
                            {selectedPayment.student.user.name}
                        </p>
                    </div>
                    <div>
                        <p class="text-gray-500">Amount</p>
                        <p class="font-medium">
                            {formatCurrency(selectedPayment.amount)}
                        </p>
                    </div>
                    <div>
                        <p class="text-gray-500">Payer Name</p>
                        <p class="font-medium">{selectedPayment.payerName}</p>
                    </div>
                    <div>
                        <p class="text-gray-500">Payment Date</p>
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
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
                    class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg"
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
