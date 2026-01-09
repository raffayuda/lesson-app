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
    let filterMethod = ""; // Payment method filter

    // Filter search states
    let filterStudentSearchQuery = "";
    let showFilterStudentDropdown = false;

    // Filtered students for filter
    $: filteredFilterStudents = students.filter(student => 
        !filterStudentSearchQuery || 
        student.user?.name?.toLowerCase().includes(filterStudentSearchQuery.toLowerCase()) ||
        student.class?.toString().includes(filterStudentSearchQuery)
    );

    // Modals
    let showProofModal = false;
    let showRejectModal = false;
    let showAddPaymentModal = false;
    let showChangeStatusModal = false;
    let selectedPayment = null;
    let rejectionReason = "";
    let newStatus = "";

    // Add payment form
    let addPaymentForm = {
        studentId: "",
        amount: "",
        description: "",
        method: "",
        paymentProof: null,
    };
    let addPaymentSubmitting = false;
    let previewImage = null;

    // Student search and filter
    let studentSearchQuery = "";
    let studentFilterClass = "";
    let showStudentDropdown = false;
    let filteredStudents = [];
    let selectedStudentName = "";

    // Reactive filtered students
    $: {
        filteredStudents = students.filter((student) => {
            const matchesSearch = !studentSearchQuery || 
                student.user.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                student.user.email.toLowerCase().includes(studentSearchQuery.toLowerCase());
            const matchesClass = !studentFilterClass || student.class === studentFilterClass;
            return matchesSearch && matchesClass;
        });
    }

    // Get unique classes from students
    $: studentClasses = [...new Set(students.map(s => s.class))].sort((a, b) => {
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
    });

    function selectStudent(student) {
        addPaymentForm.studentId = student.id;
        selectedStudentName = `${student.user.name} - Kelas ${student.class}`;
        showStudentDropdown = false;
        studentSearchQuery = "";
    }

    function clearStudentSelection() {
        addPaymentForm.studentId = "";
        selectedStudentName = "";
        studentSearchQuery = "";
        studentFilterClass = "";
    }

    onMount(() => {
        fetchData();
    });

    function openAddPaymentModal() {
        addPaymentForm = {
            studentId: "",
            amount: "",
            description: "",
            method: "",
            paymentProof: null,
        };
        previewImage = null;
        selectedStudentName = "";
        studentSearchQuery = "";
        studentFilterClass = "";
        showStudentDropdown = false;
        showAddPaymentModal = true;
    }

    function handleFileChange(event) {
        const file = event.target.files[0];
        if (file) {
            addPaymentForm.paymentProof = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    async function submitAddPayment() {
        // Trim and validate
        const studentId = addPaymentForm.studentId?.trim ? addPaymentForm.studentId.trim() : addPaymentForm.studentId;
        const amount = parseFloat(addPaymentForm.amount);
        const description = addPaymentForm.description?.trim ? addPaymentForm.description.trim() : addPaymentForm.description;
        const method = addPaymentForm.method?.trim ? addPaymentForm.method.trim() : addPaymentForm.method;

        console.log("Submit Payment Data:", { studentId, amount, description, method });

        // Validation
        if (!studentId) {
            toastStore.warning("Silakan pilih siswa terlebih dahulu");
            return;
        }
        if (!amount || amount <= 0) {
            toastStore.warning("Jumlah pembayaran harus lebih dari 0");
            return;
        }
        if (!description) {
            toastStore.warning("Deskripsi pembayaran wajib diisi");
            return;
        }
        if (!method) {
            toastStore.warning("Metode pembayaran wajib dipilih");
            return;
        }

        addPaymentSubmitting = true;
        try {
            const formData = new FormData();
            formData.append("studentId", studentId);
            formData.append("amount", amount.toString());
            formData.append("description", description);
            formData.append("method", method);
            if (addPaymentForm.paymentProof) {
                formData.append("paymentProof", addPaymentForm.paymentProof);
            }

            console.log("FormData entries:");
            for (let pair of formData.entries()) {
                console.log(pair[0] + ': ' + pair[1]);
            }

            const response = await fetch(`${API_URL}/payments/admin`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${auth.getToken()}`,
                },
                body: formData,
            });

            const responseData = await response.json();
            console.log("Response:", response.status, responseData);

            if (response.ok) {
                toastStore.success("Pembayaran berhasil ditambahkan!");
                showAddPaymentModal = false;
                addPaymentForm = {
                    studentId: "",
                    amount: "",
                    description: "",
                    method: "",
                    paymentProof: null,
                };
                previewImage = null;
                selectedStudentName = "";
                studentSearchQuery = "";
                studentFilterClass = "";
                await fetchData();
            } else {
                console.error("Payment submission error response:", response.status, responseData);
                toastStore.error(responseData.error || "Gagal menambahkan pembayaran");
            }
        } catch (error) {
            console.error("Payment submission catch error:", error);
            toastStore.error("Error: " + error.message);
        } finally {
            addPaymentSubmitting = false;
        }
    }

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
            if (filterMethod) params.append("method", filterMethod);
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
        filterMethod = "";
        filterStudentSearchQuery = "";
        showFilterStudentDropdown = false;
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

    function openChangeStatusModal(payment) {
        selectedPayment = payment;
        newStatus = payment.status;
        rejectionReason = payment.rejectionReason || "";
        showChangeStatusModal = true;
    }

    async function changePaymentStatus() {
        if (newStatus === "REJECTED" && !rejectionReason.trim()) {
            toastStore.warning("Alasan penolakan wajib diisi");
            return;
        }

        processing = true;
        processingMessage = "Mengubah status...";
        try {
            const endpoint =
                newStatus === "APPROVED"
                    ? `${API_URL}/payments/${selectedPayment.id}/approve`
                    : `${API_URL}/payments/${selectedPayment.id}/reject`;

            const response = await fetch(endpoint, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${auth.getToken()}`,
                    "Content-Type": "application/json",
                },
                body:
                    newStatus === "REJECTED"
                        ? JSON.stringify({ reason: rejectionReason })
                        : undefined,
            });

            if (response.ok) {
                toastStore.success("Status berhasil diubah!");
                showChangeStatusModal = false;
                await fetchData();
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Gagal mengubah status");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        } finally {
            processing = false;
        }
    }

    function confirmApprovePayment(payment) {
        confirmModalConfig = {
            title: "Setujui Pembayaran",
            message: `Apakah Anda yakin ingin menyetujui pembayaran dari ${payment.student.user.name}?`,
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
            title: "Hapus Pembayaran",
            message: `Apakah Anda yakin ingin menghapus pembayaran dari ${payment.student.user.name}? Tindakan ini tidak dapat dibatalkan.`,
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
        processingMessage = "Mengekspor data ke Excel...";

        try {
            // Build params with current filters to get ALL matching data
            const params = new URLSearchParams();
            params.append("limit", "10000"); // Get all data, not paginated

            // Apply current filters
            if (filterStatus) params.append("status", filterStatus);
            if (filterStudent) params.append("studentId", filterStudent);
            if (filterMethod) params.append("method", filterMethod);
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
                Tanggal: new Date(p.paymentDate).toLocaleDateString("id-ID"),
                Siswa: p.student.user.name,
                Kelas: p.student.class,
                "Nama Pembayar": p.payerName,
                Jumlah: p.amount,
                Metode: p.method || "-",
                Deskripsi: p.description,
                Status:
                    p.status === "PENDING"
                        ? "Menunggu"
                        : p.status === "APPROVED"
                          ? "Disetujui"
                          : "Ditolak",
                "Disetujui Oleh": p.approver?.name || "-",
                "Disetujui Pada": p.approvedAt
                    ? new Date(p.approvedAt).toLocaleString("id-ID")
                    : "-",
                "Alasan Penolakan": p.rejectionReason || "-",
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

            XLSX.utils.book_append_sheet(wb, ws, "Pembayaran");
            const filename = `pembayaran-${new Date().toISOString().split("T")[0]}.xlsx`;
            XLSX.writeFile(wb, filename);

            toastStore.success(
                `Berhasil mengekspor ${data.length} data pembayaran ke Excel`,
            );
        } catch (error) {
            console.error("Export error:", error);
            toastStore.error("Gagal mengekspor data: " + error.message);
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

    function getMethodLabel(method) {
        const labels = {
            CASH: "Cash / Tunai",
            BCA: "BCA",
            BRI: "BRI",
            GOPAY: "Gopay",
            SHOPEE_PAY: "Shopee Pay",
            DANA: "Dana",
            OVO: "OVO",
        };
        return labels[method] || method || "-";
    }

    function getMethodIcon(method) {
        const icons = {
            CASH: "fa-money-bill-wave",
            BCA: "fa-university",
            BRI: "fa-university",
            GOPAY: "fa-wallet",
            SHOPEE_PAY: "fa-shopping-bag",
            DANA: "fa-wallet",
            OVO: "fa-wallet",
        };
        return icons[method] || "fa-circle";
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
            <div class="flex gap-2">
                <button
                    on:click={openAddPaymentModal}
                    class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2"
                >
                    <i class="fas fa-plus"></i>
                    <span>Tambah Pembayaran</span>
                </button>
                <button
                    on:click={exportToExcel}
                    class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
                >
                    <i class="fas fa-file-excel"></i>
                    <span>Ekspor Excel</span>
                </button>
            </div>
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

            <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                    <label
                        class="block text-sm font-medium dark:text-gray-300 mb-1"
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

                <div class="relative">
                    <label
                        class="block text-sm font-medium dark:text-gray-300 mb-1"
                        >Siswa</label
                    >
                    <div class="relative">
                        <input
                            type="text"
                            bind:value={filterStudentSearchQuery}
                            on:focus={() => showFilterStudentDropdown = true}
                            placeholder="Cari siswa..."
                            class="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <i class="fas fa-search absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs"></i>
                    </div>

                    {#if showFilterStudentDropdown}
                        <div class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            <button
                                type="button"
                                on:click={() => {
                                    filterStudent = "";
                                    filterStudentSearchQuery = "";
                                    showFilterStudentDropdown = false;
                                }}
                                class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                            >
                                Semua Siswa
                            </button>
                            {#each filteredFilterStudents as student}
                                <button
                                    type="button"
                                    on:click={() => {
                                        filterStudent = student.id;
                                        filterStudentSearchQuery = `${student.user?.name || 'Unknown'} - Kelas ${student.class || '-'}`;
                                        showFilterStudentDropdown = false;
                                    }}
                                    class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white flex items-center justify-between"
                                >
                                    <span>{student.user?.name || 'Unknown'}</span>
                                    <span class="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                                        Kelas {student.class || '-'}
                                    </span>
                                </button>
                            {/each}
                            {#if filteredFilterStudents.length === 0}
                                <div class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                                    Tidak ada siswa ditemukan
                                </div>
                            {/if}
                        </div>
                    {/if}

                    {#if showFilterStudentDropdown}
                        <div class="fixed inset-0 z-40" on:click={() => showFilterStudentDropdown = false}></div>
                    {/if}
                </div>

                <div>
                    <label
                        class="block text-sm font-medium dark:text-gray-300 mb-1"
                        >Metode</label
                    >
                    <select
                        bind:value={filterMethod}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="">Semua Metode</option>
                        <option value="CASH">Cash / Tunai</option>
                        <option value="BCA">BCA</option>
                        <option value="BRI">BRI</option>
                        <option value="GOPAY">Gopay</option>
                        <option value="SHOPEE_PAY">Shopee Pay</option>
                        <option value="DANA">Dana</option>
                        <option value="OVO">OVO</option>
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
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                </div>
            </div>

            <div class="flex gap-3 mt-4">
                <button
                    on:click={applyFilters}
                    class="px-4 py-2 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    style="background-color: blue;"
                >
                    <i class="fas fa-search mr-2"></i>
                    Terapkan Filter
                </button>
                <button
                    on:click={clearFilters}
                    class="px-4 py-2 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 text-white rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    style="background-color: red;"
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
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                >Siswa</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                >Jumlah</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                >Metode</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                >Deskripsi</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                >Status</th
                            >
                            <th
                                class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                >Aksi</th
                            >
                        </tr>
                    </thead>
                    <tbody
                        class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
                    >
                        {#each payments as payment}
                            <tr
                                class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                            >
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
                                    class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white"
                                >
                                    <span
                                        class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                    >
                                        <i class="fas {getMethodIcon(payment.method)} mr-1"></i>
                                        {getMethodLabel(payment.method)}
                                    </span>
                                </td>
                                <td
                                    class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                                >
                                    {payment.description}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap">
                                    <div class="flex flex-col gap-1">
                                        <span
                                            class="px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1 w-fit {getStatusColor(
                                                payment.status,
                                            )}"
                                        >
                                            {#if payment.status === "PENDING"}
                                                <i class="fas fa-clock"></i>
                                                Menunggu
                                            {:else if payment.status === "APPROVED"}
                                                <i class="fas fa-check-circle"
                                                ></i>
                                                Disetujui
                                            {:else if payment.status === "REJECTED"}
                                                <i class="fas fa-times-circle"
                                                ></i>
                                                Ditolak
                                            {/if}
                                        </span>
                                        {#if payment.approver}
                                            <p
                                                class="text-xs text-gray-500 dark:text-gray-400"
                                            >
                                                <i class="fas fa-user text-xs"
                                                ></i>
                                                {payment.approver.name}
                                            </p>
                                            {#if payment.status === "REJECTED" && payment.rejectionReason}
                                                <p
                                                    class="text-xs text-red-600 dark:text-red-400"
                                                >
                                                    <i
                                                        class="fas fa-info-circle"
                                                    ></i>
                                                    {payment.rejectionReason}
                                                </p>
                                            {/if}
                                        {/if}
                                    </div>
                                </td>
                                <td
                                    class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium"
                                >
                                    <div
                                        class="flex items-center justify-end gap-2"
                                    >
                                        {#if payment.proofUrl}
                                            <button
                                                on:click={() => viewProof(payment)}
                                                class="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="Lihat Bukti"
                                            >
                                                <i class="fas fa-image"></i>
                                            </button>
                                        {:else}
                                            <button
                                                on:click={() => viewProof(payment)}
                                                class="p-2 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/20 rounded-lg transition-colors"
                                                title="Tidak ada bukti"
                                            >
                                                <i class="fas fa-image-slash"></i>
                                            </button>
                                        {/if}
                                        <button
                                            on:click={() =>
                                                openChangeStatusModal(payment)}
                                            class="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                            title="Ubah Status"
                                        >
                                            <i class="fas fa-exchange-alt"></i>
                                        </button>
                                        <button
                                            on:click={() =>
                                                confirmDeletePayment(payment)}
                                            class="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Hapus"
                                        >
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
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
            class="bg-white rounded-lg max-w-3xl w-full p-6 dark:bg-gray-800"
            on:click|stopPropagation
            role="dialog"
            tabindex="-1"
        >
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                    Bukti Pembayaran
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
                        <p class="text-gray-500 dark:text-gray-400">Siswa</p>
                        <p class="font-medium">
                            {selectedPayment.student.user.name}
                        </p>
                    </div>
                    <div>
                        <p class="text-gray-500 dark:text-gray-400">Jumlah</p>
                        <p class="font-medium">
                            {formatCurrency(selectedPayment.amount)}
                        </p>
                    </div>
                    <div>
                        <p class="text-gray-500 dark:text-gray-400">
                            Nama Pembayar
                        </p>
                        <p class="font-medium">{selectedPayment.payerName}</p>
                    </div>
                    <div>
                        <p class="text-gray-500 dark:text-gray-400">
                            Tanggal Pembayaran
                        </p>
                        <p class="font-medium">
                            {new Date(
                                selectedPayment.paymentDate,
                            ).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div>
                    <p class="text-gray-500 text-sm mb-1">Deskripsi</p>
                    <p class="text-sm">{selectedPayment.description}</p>
                </div>

                <div>
                    <p class="text-gray-500 dark:text-gray-400 text-sm mb-2">Bukti Pembayaran</p>
                    {#if selectedPayment.proofUrl && selectedPayment.proofUrl !== null}
                        <img
                            src={selectedPayment.proofUrl}
                            alt="Bukti Pembayaran"
                            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 h-auto max-h-[300px] object-contain bg-gray-50 dark:bg-gray-900"
                        />
                    {:else}
                        <div class="w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                            <div class="flex flex-col items-center justify-center text-center">
                                <div class="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 flex items-center justify-center mb-4 shadow-lg">
                                    <i class="fas fa-receipt text-3xl text-blue-600 dark:text-blue-300"></i>
                                </div>
                                <p class="text-gray-600 dark:text-gray-400 font-medium mb-1">Tidak Ada Bukti Pembayaran</p>
                                <p class="text-xs text-gray-500 dark:text-gray-500">Pembayaran ini dibuat tanpa bukti upload</p>
                            </div>
                        </div>
                    {/if}
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
        <div class="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3
                class="text-xl font-semibold text-gray-900 dark:text-white mb-4"
            >
                Tolak Pembayaran
            </h3>

            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Menolak pembayaran dari <strong
                    >{selectedPayment.student.user.name}</strong
                >
            </p>

            <div class="mb-4">
                <label class="block text-sm font-medium dark:text-gray-300 mb-1"
                    >Alasan Penolakan</label
                >
                <textarea
                    bind:value={rejectionReason}
                    rows="3"
                    required
                    class="w-full px-3 py-2 border dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
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
                    Batal
                </button>
                <button
                    on:click={rejectPayment}
                    class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                    <i class="fas fa-times mr-2"></i>
                    Tolak Pembayaran
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Add Payment Modal -->
{#if showAddPaymentModal}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        on:click={() => {
            showAddPaymentModal = false;
            addPaymentForm = {
                studentId: "",
                amount: "",
                description: "",
                method: "",
                paymentProof: null,
            };
            previewImage = null;
            selectedStudentName = "";
            studentSearchQuery = "";
            studentFilterClass = "";
            showStudentDropdown = false;
        }}
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            on:click|stopPropagation
        >
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
                <i class="fas fa-plus mr-2 text-primary-600"></i>
                Tambah Pembayaran Manual
            </h3>

            <form on:submit|preventDefault={submitAddPayment} class="space-y-4">
                <!-- Student Selection -->
                <div class="relative">
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >Siswa <span class="text-red-500">*</span></label
                    >
                    
                    <!-- Selected Student Display or Search Input -->
                    {#if !addPaymentForm.studentId}
                        <div class="space-y-2">
                            <!-- Search Input -->
                            <div class="relative">
                                <input
                                    type="text"
                                    bind:value={studentSearchQuery}
                                    on:focus={() => showStudentDropdown = true}
                                    placeholder="Cari siswa berdasarkan nama atau email..."
                                    class="w-full px-3 py-2 pr-10 border dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                                />
                                <i class="fas fa-search absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                            </div>

                            <!-- Class Filter -->
                            <select
                                bind:value={studentFilterClass}
                                on:focus={() => showStudentDropdown = true}
                                class="w-full px-3 py-2 border dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white text-sm"
                            >
                                <option value="">Semua Kelas</option>
                                {#each studentClasses as cls}
                                    <option value={cls}>Kelas {cls}</option>
                                {/each}
                            </select>

                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                <i class="fas fa-info-circle mr-1"></i>
                                Pilih siswa dari daftar yang muncul
                            </p>
                        </div>

                        <!-- Dropdown List -->
                        {#if showStudentDropdown}
                            <div class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {#if filteredStudents.length === 0}
                                    <div class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                                        <i class="fas fa-inbox mb-1"></i>
                                        <p>Tidak ada siswa ditemukan</p>
                                    </div>
                                {:else}
                                    {#each filteredStudents as student}
                                        <button
                                            type="button"
                                            on:click={() => selectStudent(student)}
                                            class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-between group"
                                        >
                                            <span class="text-gray-900 dark:text-white">
                                                {student.user.name}
                                            </span>
                                            <span class="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                                                Kelas {student.class}
                                            </span>
                                        </button>
                                    {/each}
                                {/if}
                            </div>
                        {/if}
                    {:else}
                        <!-- Selected Student Display -->
                        <div class="flex items-center gap-2 w-full px-3 py-2 border dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white">
                            <span class="flex-1">{selectedStudentName}</span>
                            <button
                                type="button"
                                on:click={clearStudentSelection}
                                class="text-red-500 hover:text-red-700 transition-colors"
                                title="Hapus pilihan"
                            >
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    {/if}

                    <!-- Click outside to close dropdown -->
                    {#if showStudentDropdown}
                        <div 
                            class="fixed inset-0 z-40" 
                            on:click={() => showStudentDropdown = false}
                        ></div>
                    {/if}
                </div>

                <!-- Amount -->
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >Jumlah Pembayaran <span class="text-red-500">*</span
                        ></label
                    >
                    <input
                        type="number"
                        bind:value={addPaymentForm.amount}
                        required
                        min="1"
                        step="any"
                        class="w-full px-3 py-2 border dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                        placeholder="Contoh: 500000"
                    />
                </div>

                <!-- Description -->
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >Deskripsi <span class="text-red-500">*</span></label
                    >
                    <textarea
                        bind:value={addPaymentForm.description}
                        required
                        rows="3"
                        class="w-full px-3 py-2 border dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                        placeholder="Contoh: Bayar Les Bulan Juni"
                    ></textarea>
                </div>

                <!-- Payment Method -->
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >Metode Pembayaran <span class="text-red-500">*</span></label
                    >
                    <select
                        bind:value={addPaymentForm.method}
                        required
                        class="w-full px-3 py-2 border dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                    >
                        <option value="">-- Pilih Metode --</option>
                        <option value="CASH">Cash / Tunai</option>
                        <option value="BCA">BCA</option>
                        <option value="BRI">BRI</option>
                        <option value="GOPAY">Gopay</option>
                        <option value="SHOPEE_PAY">Shopee Pay</option>
                        <option value="DANA">Dana</option>
                        <option value="OVO">OVO</option>
                    </select>
                </div>

                <!-- Payment Proof (Optional) -->
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >Bukti Pembayaran (Opsional)</label
                    >
                    <input
                        type="file"
                        accept="image/*"
                        on:change={handleFileChange}
                        class="w-full px-3 py-2 border dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Format: JPG, PNG (Maks. 5MB)
                    </p>

                    {#if previewImage}
                        <div class="mt-3">
                            <img
                                src={previewImage}
                                alt="Preview"
                                class="w-full h-48 object-cover rounded-lg"
                            />
                        </div>
                    {/if}
                </div>

                <!-- Buttons -->
                <div class="flex gap-3 justify-end pt-4">
                    <button
                        type="button"
                        on:click={() => {
                            showAddPaymentModal = false;
                            addPaymentForm = {
                                studentId: "",
                                amount: "",
                                description: "",
                                method: "",
                                paymentProof: null,
                            };
                            previewImage = null;
                            selectedStudentName = "";
                            studentSearchQuery = "";
                            studentFilterClass = "";
                            showStudentDropdown = false;
                        }}
                        class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg"
                        disabled={addPaymentSubmitting}
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={addPaymentSubmitting || !addPaymentForm.studentId}
                    >
                        {#if addPaymentSubmitting}
                            <i class="fas fa-spinner fa-spin mr-2"></i>
                            Menyimpan...
                        {:else}
                            <i class="fas fa-save mr-2"></i>
                            Simpan Pembayaran
                        {/if}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<!-- Change Status Modal -->
{#if showChangeStatusModal && selectedPayment}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        on:click={() => {
            showChangeStatusModal = false;
            selectedPayment = null;
            newStatus = "";
            rejectionReason = "";
        }}
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full"
            on:click|stopPropagation
        >
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
                <i class="fas fa-exchange-alt mr-2 text-purple-600"></i>
                Ubah Status Pembayaran
            </h3>

            <div class="space-y-4">
                <!-- Payment Info -->
                <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <p class="text-sm text-gray-600 dark:text-gray-300">
                        <span class="font-semibold">Siswa:</span>
                        {selectedPayment.student.user.name}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        <span class="font-semibold">Jumlah:</span>
                        {formatCurrency(selectedPayment.amount)}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        <span class="font-semibold">Deskripsi:</span>
                        {selectedPayment.description}
                    </p>
                </div>

                <!-- Status Selection -->
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >Status Baru <span class="text-red-500">*</span></label
                    >
                    <div class="space-y-2">
                        <label
                            class="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 {newStatus ===
                            'APPROVED'
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                                : ''}"
                        >
                            <input
                                type="radio"
                                bind:group={newStatus}
                                value="APPROVED"
                                class="mr-3"
                            />
                            <i class="fas fa-check-circle text-green-600 mr-2"
                            ></i>
                            <span
                                class="text-sm font-medium text-gray-700 dark:text-gray-200"
                                >Disetujui</span
                            >
                        </label>
                        <label
                            class="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 {newStatus ===
                            'REJECTED'
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                                : ''}"
                        >
                            <input
                                type="radio"
                                bind:group={newStatus}
                                value="REJECTED"
                                class="mr-3"
                            />
                            <i class="fas fa-times-circle text-red-600 mr-2"
                            ></i>
                            <span
                                class="text-sm font-medium text-gray-700 dark:text-gray-200"
                                >Ditolak</span
                            >
                        </label>
                    </div>
                </div>

                <!-- Rejection Reason (shown when REJECTED selected) -->
                {#if newStatus === "REJECTED"}
                    <div>
                        <label
                            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                            >Alasan Penolakan <span class="text-red-500">*</span
                            ></label
                        >
                        <textarea
                            bind:value={rejectionReason}
                            rows="3"
                            required
                            class="w-full px-3 py-2 border dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                            placeholder="Masukkan alasan penolakan..."
                        ></textarea>
                    </div>
                {/if}

                <!-- Buttons -->
                <div class="flex gap-3 justify-end pt-4">
                    <button
                        on:click={() => {
                            showChangeStatusModal = false;
                            selectedPayment = null;
                            newStatus = "";
                            rejectionReason = "";
                        }}
                        class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg"
                    >
                        Batal
                    </button>
                    <button
                        on:click={changePaymentStatus}
                        class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
                        disabled={!newStatus}
                    >
                        <i class="fas fa-save mr-2"></i>
                        Simpan Perubahan
                    </button>
                </div>
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
