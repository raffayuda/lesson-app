<script>
    import Layout from "../../components/Layout.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { onMount } from "svelte";
    import * as XLSX from "xlsx";

    let attendances = [];
    let schedules = [];
    let students = [];
    let loading = true;

    // Filters
    let filterDate = "";
    let filterSchedule = "";
    let filterStudent = "";
    let filterStatus = "";
    let filterMethod = "";

    onMount(() => {
        fetchData();
    });

    async function fetchData() {
        loading = true;
        try {
            const [attendanceRes, schedulesRes, studentsRes] =
                await Promise.all([
                    fetch(`${API_URL}/attendance`, {
                        headers: { Authorization: `Bearer ${auth.getToken()}` },
                    }),
                    fetch(`${API_URL}/schedules`, {
                        headers: { Authorization: `Bearer ${auth.getToken()}` },
                    }),
                    fetch(`${API_URL}/students`, {
                        headers: { Authorization: `Bearer ${auth.getToken()}` },
                    }),
                ]);

            if (attendanceRes.ok) attendances = await attendanceRes.json();
            if (schedulesRes.ok) schedules = await schedulesRes.json();
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
            if (filterDate) params.append("date", filterDate);
            if (filterSchedule) params.append("scheduleId", filterSchedule);
            if (filterStudent) params.append("studentId", filterStudent);
            if (filterStatus) params.append("status", filterStatus);

            const response = await fetch(`${API_URL}/attendance?${params}`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (response.ok) {
                attendances = await response.json();
            }
        } catch (error) {
            console.error("Error:", error);
        } finally {
            loading = false;
        }
    }

    function clearFilters() {
        filterDate = "";
        filterSchedule = "";
        filterStudent = "";
        filterStatus = "";
        filterMethod = "";
        fetchData();
    }

    async function exportToExcel() {
        loading = true;

        try {
            // Build params with current filters to get ALL matching data
            const params = new URLSearchParams();
            params.append("limit", "10000"); // Get all data, not paginated

            // Apply current filters
            if (filterDate) params.append("date", filterDate);
            if (filterSchedule) params.append("scheduleId", filterSchedule);
            if (filterStudent) params.append("studentId", filterStudent);
            if (filterStatus) params.append("status", filterStatus);

            const response = await fetch(`${API_URL}/attendance?${params}`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch data for export");
            }

            const exportData = await response.json();

            // Apply client-side method filter if set
            const filteredData = filterMethod
                ? exportData.filter((att) => att.method === filterMethod)
                : exportData;

            // Prepare data for Excel
            const data = filteredData.map((att) => ({
                Date: new Date(att.checkInTime).toLocaleDateString(),
                Time: new Date(att.checkInTime).toLocaleTimeString(),
                Student: att.student.user.name,
                "Student ID": att.student.studentId,
                Subject: att.schedule.subject,
                Class: att.schedule.class,
                Status: getStatusLabel(att.status),
                Method: att.method,
                "Marked By": att.markedBy?.name || "-",
            }));

            // Create workbook and worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);

            // Set column widths
            ws["!cols"] = [
                { wch: 12 }, // Date
                { wch: 12 }, // Time
                { wch: 20 }, // Student
                { wch: 12 }, // Student ID
                { wch: 15 }, // Subject
                { wch: 10 }, // Class
                { wch: 10 }, // Status
                { wch: 10 }, // Method
                { wch: 15 }, // Marked By
            ];

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, "Attendance History");

            // Generate filename with current date
            const filename = `attendance-history-${new Date().toISOString().split("T")[0]}.xlsx`;

            // Save file
            XLSX.writeFile(wb, filename);

            console.log(`Exported ${data.length} attendance records to Excel`);
        } catch (error) {
            console.error("Export error:", error);
            alert("Failed to export data: " + error.message);
        } finally {
            loading = false;
        }
    }

    function getStatusColor(status) {
        const colors = {
            PRESENT: "bg-green-100 text-green-800",
            SICK: "bg-yellow-100 text-yellow-800",
            PERMISSION: "bg-blue-100 text-blue-800",
            ABSENT: "bg-red-100 text-red-800",
        };
        return colors[status] || "bg-gray-100 text-gray-800";
    }

    function getStatusLabel(status) {
        const labels = {
            PRESENT: "Hadir",
            SICK: "Sakit",
            PERMISSION: "Izin",
            ABSENT: "Alfa",
        };
        return labels[status] || status;
    }

    $: filteredAttendances = attendances.filter((att) => {
        if (filterMethod && att.method !== filterMethod) return false;
        return true;
    });

    $: stats = {
        total: filteredAttendances.length,
        present: filteredAttendances.filter((a) => a.status === "PRESENT")
            .length,
        sick: filteredAttendances.filter((a) => a.status === "SICK").length,
        permission: filteredAttendances.filter((a) => a.status === "PERMISSION")
            .length,
        absent: filteredAttendances.filter((a) => a.status === "ABSENT").length,
        manual: filteredAttendances.filter((a) => a.method === "MANUAL").length,
        qr: filteredAttendances.filter((a) => a.method === "QR").length,
    };
</script>

<Layout activePage="/history" title="Riwayat Absensi">
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex justify-between items-center">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                <i class="fas fa-history mr-2"></i>
                Riwayat Absensi
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
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div
                class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center border border-gray-200 dark:border-gray-700"
            >
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.total}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Total
                </p>
            </div>
            <div
                class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center border-l-4 border-green-500"
            >
                <p
                    class="text-2xl font-bold text-green-600 dark:text-green-400"
                >
                    {stats.present}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Hadir
                </p>
            </div>
            <div
                class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center border-l-4 border-yellow-500"
            >
                <p
                    class="text-2xl font-bold text-yellow-600 dark:text-yellow-400"
                >
                    {stats.sick}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Sakit
                </p>
            </div>
            <div
                class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center border-l-4 border-blue-500"
            >
                <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.permission}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Izin
                </p>
            </div>
            <div
                class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center border-l-4 border-red-500"
            >
                <p class="text-2xl font-bold text-red-600 dark:text-red-400">
                    {stats.absent}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Alfa
                </p>
            </div>
            <div
                class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center border-l-4 border-purple-500"
            >
                <p
                    class="text-2xl font-bold text-purple-600 dark:text-purple-400"
                >
                    {stats.manual}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Manual
                </p>
            </div>
            <div
                class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center border-l-4 border-indigo-500"
            >
                <p
                    class="text-2xl font-bold text-indigo-600 dark:text-indigo-400"
                >
                    {stats.qr}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    QR Code
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
                Filters
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >Tanggal</label
                    >
                    <input
                        type="date"
                        bind:value={filterDate}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Jadwal</label
                    >
                    <select
                        bind:value={filterSchedule}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="">Semua Jadwal</option>
                        {#each schedules as schedule}
                            <option value={schedule.id}
                                >{schedule.subject} - {schedule.class}</option
                            >
                        {/each}
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
                        >Status</label
                    >
                    <select
                        bind:value={filterStatus}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="">Semua Status</option>
                        <option value="PRESENT">Hadir</option>
                        <option value="SICK">Sakit</option>
                        <option value="PERMISSION">Izin</option>
                        <option value="ABSENT">Alfa</option>
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Method</label
                    >
                    <select
                        bind:value={filterMethod}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="">Semua Metode</option>
                        <option value="MANUAL">Manual</option>
                        <option value="QR">QR Code</option>
                    </select>
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

        <!-- Table -->
        <div
            class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
        >
            {#if loading}
                <div class="flex justify-center py-20">
                    <i class="fas fa-spinner fa-spin text-4xl text-primary-500"
                    ></i>
                </div>
            {:else if filteredAttendances.length === 0}
                <div class="text-center py-20 text-gray-500 dark:text-gray-400">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>No attendance records found</p>
                </div>
            {:else}
                <div class="overflow-x-auto">
                    <table
                        class="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
                    >
                        <thead class="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                    >Tanggal & Waktu</th
                                >
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                    >Siswa</th
                                >
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                    >Jadwal</th
                                >
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                    >Status</th
                                >
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                    >Metode</th
                                >
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                    >Ditandai Oleh</th
                                >
                            </tr>
                        </thead>
                        <tbody
                            class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
                        >
                            {#each filteredAttendances as attendance}
                                <tr
                                    class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <td
                                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                    >
                                        <div class="dark:text-white">
                                            {new Date(
                                                attendance.checkInTime,
                                            ).toLocaleDateString()}
                                        </div>
                                        <div
                                            class="text-xs text-gray-500 dark:text-gray-400"
                                        >
                                            {new Date(
                                                attendance.checkInTime,
                                            ).toLocaleTimeString()}
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <div
                                            class="text-sm font-medium text-gray-900 dark:text-white"
                                        >
                                            {attendance.student.user.name}
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <div
                                            class="text-sm text-gray-900 dark:text-white"
                                        >
                                            {attendance.schedule.subject}
                                        </div>
                                        <div
                                            class="text-xs text-gray-500 dark:text-gray-400"
                                        >
                                            Kelas: {attendance.schedule.class}
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span
                                            class="px-2 py-1 text-xs font-medium rounded-full {getStatusColor(
                                                attendance.status,
                                            )}"
                                        >
                                            {getStatusLabel(attendance.status)}
                                        </span>
                                    </td>
                                    <td
                                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                    >
                                        {#if attendance.method === "MANUAL"}
                                            <span
                                                class="inline-flex items-center gap-1"
                                            >
                                                <i
                                                    class="fas fa-clipboard-list text-purple-600"
                                                ></i>
                                                Manual
                                            </span>
                                        {:else}
                                            <span
                                                class="inline-flex items-center gap-1"
                                            >
                                                <i
                                                    class="fas fa-qrcode text-indigo-600"
                                                ></i>
                                                QR Code
                                            </span>
                                        {/if}
                                    </td>
                                    <td
                                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                    >
                                        {attendance.markedBy?.name || "-"}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {/if}
        </div>
    </div>
</Layout>
