<script>
    import Layout from "../../components/Layout.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { onMount } from "svelte";
    import * as XLSX from "xlsx";

    let attendances = [];
    let allAttendances = []; // For stats
    let loading = true;

    // Pagination
    let currentPage = 1;
    let limit = 10;
    let totalPages = 1;

    // Filters
    let filterStatus = "";
    let filterSubject = "";
    let filterStartDate = "";
    let filterEndDate = "";

    onMount(() => {
        fetchAttendances();
    });

    async function fetchAttendances() {
        loading = true;
        try {
            const student = $auth.user.student;
            if (!student) return;

            const response = await fetch(
                `${API_URL}/attendance?studentId=${student.id}`,
                {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                },
            );

            if (response.ok) {
                allAttendances = await response.json();
                applyFiltersAndPagination();
            }
        } catch (error) {
            console.error("Error fetching attendance:", error);
        } finally {
            loading = false;
        }
    }

    function applyFiltersAndPagination() {
        let filtered = [...allAttendances];

        // Apply filters
        if (filterStatus) {
            filtered = filtered.filter((a) => a.status === filterStatus);
        }
        if (filterSubject) {
            filtered = filtered.filter(
                (a) => a.schedule.subject === filterSubject,
            );
        }
        if (filterStartDate) {
            filtered = filtered.filter(
                (a) => new Date(a.checkInTime) >= new Date(filterStartDate),
            );
        }
        if (filterEndDate) {
            const endDate = new Date(filterEndDate);
            endDate.setHours(23, 59, 59);
            filtered = filtered.filter(
                (a) => new Date(a.checkInTime) <= endDate,
            );
        }

        // Calculate pagination
        totalPages = Math.ceil(filtered.length / limit);
        const start = (currentPage - 1) * limit;
        const end = start + limit;
        attendances = filtered.slice(start, end);
    }

    function clearFilters() {
        filterStatus = "";
        filterSubject = "";
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

    function exportToExcel() {
        const data = attendances.map((a) => ({
            Date: new Date(a.checkInTime).toLocaleDateString(),
            Time: new Date(a.checkInTime).toLocaleTimeString(),
            Subject: a.schedule.subject,
            Class: a.schedule.class,
            Status: a.status,
            Method: a.method,
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);

        ws["!cols"] = [
            { wch: 12 },
            { wch: 12 },
            { wch: 20 },
            { wch: 10 },
            { wch: 10 },
            { wch: 10 },
        ];

        XLSX.utils.book_append_sheet(wb, ws, "My Attendance");
        const filename = `my-attendance-${new Date().toISOString().split("T")[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
    }

    function getStatusColor(status) {
        const colors = {
            PRESENT: "bg-green-100 text-green-800",
            LATE: "bg-yellow-100 text-yellow-800",
            EXCUSED: "bg-blue-100 text-blue-800",
            ABSENT: "bg-red-100 text-red-800",
        };
        return colors[status] || "bg-gray-100 text-gray-800";
    }

    function getStatusLabel(status) {
        const labels = {
            PRESENT: "Hadir",
            LATE: "Terlambat",
            EXCUSED: "Izin",
            ABSENT: "Tidak Hadir",
        };
        return labels[status] || status;
    }

    // Get unique subjects for filter
    $: subjects = [...new Set(allAttendances.map((a) => a.schedule.subject))];

    // Calculate stats
    $: stats = {
        total: allAttendances.length,
        present: allAttendances.filter((a) => a.status === "PRESENT").length,
        late: allAttendances.filter((a) => a.status === "LATE").length,
        excused: allAttendances.filter((a) => a.status === "EXCUSED").length,
        absent: allAttendances.filter((a) => a.status === "ABSENT").length,
        rate:
            allAttendances.length > 0
                ? (
                      (allAttendances.filter((a) => a.status === "PRESENT")
                          .length /
                          allAttendances.length) *
                      100
                  ).toFixed(1)
                : 0,
    };

    // Reactive: re-apply filters when filter values change
    $: if (filterStatus || filterSubject || filterStartDate || filterEndDate) {
        currentPage = 1;
        applyFiltersAndPagination();
    }
</script>

<Layout activePage="/attendance" title="My Attendance">
    <div class="space-y-6">
        <!-- Header -->
        <div
            class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
            <h2 class="text-2xl font-bold text-gray-900">
                <i class="fas fa-clipboard-check mr-2"></i>
                My Attendance
            </h2>
            <button
                on:click={exportToExcel}
                disabled={attendances.length === 0}
                class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2"
            >
                <i class="fas fa-file-excel"></i>
                <span>Export Excel</span>
            </button>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div class="bg-white rounded-lg shadow p-4 text-center">
                <p class="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p class="text-xs text-gray-500 mt-1">Total</p>
            </div>
            <div
                class="bg-white rounded-lg shadow p-4 text-center border-l-4 border-green-500"
            >
                <p class="text-2xl font-bold text-green-600">
                    {stats.present}
                </p>
                <p class="text-xs text-gray-500 mt-1">Hadir</p>
            </div>
            <div
                class="bg-white rounded-lg shadow p-4 text-center border-l-4 border-yellow-500"
            >
                <p class="text-2xl font-bold text-yellow-600">{stats.late}</p>
                <p class="text-xs text-gray-500 mt-1">Terlambat</p>
            </div>
            <div
                class="bg-white rounded-lg shadow p-4 text-center border-l-4 border-blue-500"
            >
                <p class="text-2xl font-bold text-blue-600">
                    {stats.excused}
                </p>
                <p class="text-xs text-gray-500 mt-1">Izin</p>
            </div>
            <div
                class="bg-white rounded-lg shadow p-4 text-center border-l-4 border-red-500"
            >
                <p class="text-2xl font-bold text-red-600">{stats.absent}</p>
                <p class="text-xs text-gray-500 mt-1">Tidak Hadir</p>
            </div>
            <div
                class="bg-white rounded-lg shadow p-4 text-center border-l-4 border-indigo-500"
            >
                <p class="text-2xl font-bold text-indigo-600">
                    {stats.rate}%
                </p>
                <p class="text-xs text-gray-500 mt-1">Kehadiran</p>
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
                        <option value="PRESENT">Hadir</option>
                        <option value="LATE">Terlambat</option>
                        <option value="EXCUSED">Izin</option>
                        <option value="ABSENT">Tidak Hadir</option>
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Subject</label
                    >
                    <select
                        bind:value={filterSubject}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    >
                        <option value="">All Subjects</option>
                        {#each subjects as subject}
                            <option value={subject}>{subject}</option>
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
                    on:click={clearFilters}
                    class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                >
                    <i class="fas fa-times mr-2"></i>
                    Clear Filters
                </button>
            </div>
        </div>

        <!-- Attendance Table -->
        <div class="bg-white rounded-lg shadow overflow-x-auto">
            {#if loading}
                <div class="flex justify-center py-20">
                    <i class="fas fa-spinner fa-spin text-4xl text-primary-500"
                    ></i>
                </div>
            {:else if attendances.length === 0}
                <div class="text-center py-20 text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>No attendance records found</p>
                </div>
            {:else}
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Date & Time</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Subject</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Class</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Status</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Method</th
                            >
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        {#each attendances as attendance}
                            <tr class="hover:bg-gray-50">
                                <td
                                    class="px-4 py-3 whitespace-nowrap text-sm text-gray-900"
                                >
                                    <div>
                                        {new Date(
                                            attendance.checkInTime,
                                        ).toLocaleDateString()}
                                    </div>
                                    <div class="text-xs text-gray-500">
                                        {new Date(
                                            attendance.checkInTime,
                                        ).toLocaleTimeString()}
                                    </div>
                                </td>
                                <td
                                    class="px-4 py-3 text-sm font-medium text-gray-900"
                                >
                                    {attendance.schedule.subject}
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-500">
                                    {attendance.schedule.class}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap">
                                    <span
                                        class="px-2 py-1 text-xs font-medium rounded-full {getStatusColor(
                                            attendance.status,
                                        )}"
                                    >
                                        {getStatusLabel(attendance.status)}
                                    </span>
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap">
                                    {#if attendance.method === "QR"}
                                        <i
                                            class="fas fa-qrcode text-indigo-600"
                                            title="QR Code"
                                        ></i>
                                    {:else}
                                        <i
                                            class="fas fa-user-edit text-gray-600"
                                            title="Manual"
                                        ></i>
                                    {/if}
                                    <span class="ml-2 text-xs text-gray-500">
                                        {attendance.method}
                                    </span>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>

                <!-- Pagination -->
                {#if totalPages > 1}
                    <div
                        class="px-6 py-4 border-t border-gray-200 flex items-center justify-between"
                    >
                        <div class="text-sm text-gray-700">
                            Showing <span class="font-medium"
                                >{(currentPage - 1) * limit + 1}</span
                            >
                            to
                            <span class="font-medium"
                                >{Math.min(
                                    currentPage * limit,
                                    attendances.length,
                                )}</span
                            >
                            of
                            <span class="font-medium">{attendances.length}</span
                            > records
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
                                    <span class="px-2 text-gray-500">...</span>
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
