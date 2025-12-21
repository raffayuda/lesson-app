<script>
    import Layout from "../../components/Layout.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { onMount } from "svelte";

    let schedules = [];
    let loading = true;
    
    // Modal for attendance history
    let showHistoryModal = false;
    let selectedSchedule = null;
    let scheduleAttendances = [];
    let loadingHistory = false;

    // Pagination for modal
    let currentPage = 1;
    let limit = 10;
    let totalPages = 1;

    onMount(() => {
        fetchSchedules();
    });

    async function fetchSchedules() {
        loading = true;
        try {
            const student = $auth.user.student;
            if (!student) return;

            const response = await fetch(
                `${API_URL}/students/${student.id}/schedules`,
                {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                },
            );

            if (response.ok) {
                schedules = await response.json();
                console.log('Fetched schedules:', schedules);
            }
        } catch (error) {
            console.error("Error fetching schedules:", error);
        } finally {
            loading = false;
        }
    }

    async function openHistory(schedule) {
        selectedSchedule = schedule;
        showHistoryModal = true;
        currentPage = 1;
        
        await fetchScheduleHistory();
    }

    async function fetchScheduleHistory() {
        loadingHistory = true;
        try {
            const student = $auth.user.student;
            if (!student || !selectedSchedule) return;

            const response = await fetch(
                `${API_URL}/attendance?studentId=${student.id}&scheduleId=${selectedSchedule.id}`,
                {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                },
            );

            if (response.ok) {
                const allData = await response.json();
                
                // Calculate pagination
                totalPages = Math.ceil(allData.length / limit) || 1;
                const start = (currentPage - 1) * limit;
                const end = start + limit;
                scheduleAttendances = allData.slice(start, end);
            }
        } catch (error) {
            console.error("Error fetching schedule history:", error);
        } finally {
            loadingHistory = false;
        }
    }

    function goToPage(page) {
        if (page >= 1 && page <= totalPages) {
            currentPage = page;
            fetchScheduleHistory();
        }
    }

    function nextPage() {
        if (currentPage < totalPages) {
            currentPage++;
            fetchScheduleHistory();
        }
    }

    function prevPage() {
        if (currentPage > 1) {
            currentPage--;
            fetchScheduleHistory();
        }
    }

    function getScheduleType(schedule) {
        return schedule.specificDate ? "Tanggal Tertentu" : "Berulang";
    }

    function getScheduleLabel(schedule) {
        if (schedule.specificDate) {
            const date = new Date(schedule.specificDate);
            return `${date.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
        } else {
            // Day is already in Indonesian in database (Senin, Selasa, etc.)
            return `Setiap ${schedule.day}`;
        }
    }

    function getStatusColor(status) {
        const colors = {
            PRESENT: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
            SICK: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
            PERMISSION: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
            ABSENT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
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
</script>

<Layout activePage="/attendance" title="Jadwal Saya">
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex justify-between items-center">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                <i class="fas fa-calendar-alt mr-2"></i>
                Jadwal Saya
            </h2>
        </div>

        <!-- Loading State -->
        {#if loading}
            <div class="flex items-center justify-center py-20">
                <i class="fas fa-spinner fa-spin text-4xl text-primary-500"></i>
            </div>
        {:else if schedules.length === 0}
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                <i class="fas fa-calendar-times text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
                <p class="text-gray-500 dark:text-gray-400 text-lg">Belum ada jadwal</p>
            </div>
        {:else}
            <!-- Schedule Cards Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {#each schedules as schedule}
                    <div
                        class="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer"
                        on:click={() => openHistory(schedule)}
                    >
                        <!-- Card Header with Color -->
                        <div class="p-4 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <h3 class="font-bold text-lg">{schedule.subject}</h3>
                            <p class="text-sm opacity-80">{schedule.class}</p>
                        </div>

                        <!-- Card Body -->
                        <div class="p-4 space-y-3">
                            <!-- Schedule Type Badge -->
                            <div class="flex items-center gap-2">
                                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium {schedule.specificDate ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'}">
                                    <i class="fas {schedule.specificDate ? 'fa-calendar-day' : 'fa-sync-alt'} mr-1"></i>
                                    {getScheduleType(schedule)}
                                </span>
                            </div>

                            <!-- Schedule Info -->
                            <div class="space-y-2">
                                <div class="flex items-center text-gray-600 dark:text-gray-400">
                                    <i class="fas fa-clock w-5"></i>
                                    <span class="text-sm">{schedule.startTime} - {schedule.endTime}</span>
                                </div>
                                <div class="flex items-center text-gray-600 dark:text-gray-400">
                                    <i class="fas {schedule.specificDate ? 'fa-calendar-day' : 'fa-calendar-week'} w-5"></i>
                                    <span class="text-sm">{getScheduleLabel(schedule)}</span>
                                </div>
                                <div class="flex items-center text-gray-600 dark:text-gray-400">
                                    <i class="fas fa-chalkboard-teacher w-5"></i>
                                    <span class="text-sm">{schedule.teacherName}</span>
                                </div>
                            </div>

                            <!-- View History Button -->
                            <div class="pt-3 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    on:click={() => openHistory(schedule)}
                                    class="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
                                >
                                    <i class="fas fa-history mr-2"></i>
                                    Lihat Riwayat Absensi
                                </button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- History Modal -->
    {#if showHistoryModal && selectedSchedule}
        <div 
            class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            on:click={(e) => e.target === e.currentTarget && (showHistoryModal = false)}
            on:keydown={(e) => e.key === 'Escape' && (showHistoryModal = false)}
            role="dialog"
            aria-modal="true"
            tabindex="-1"
        >
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
                <!-- Header -->
                <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
                    <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                        Riwayat Absensi - {selectedSchedule.subject}
                    </h2>
                    <button
                        on:click={() => showHistoryModal = false}
                        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>

                <!-- Content -->
                <div class="p-6 space-y-4">
                <!-- Schedule Info -->
                <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="font-semibold text-gray-900 dark:text-white">{selectedSchedule.subject}</h3>
                            <p class="text-sm text-gray-600 dark:text-gray-400">{selectedSchedule.class}</p>
                        </div>
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium {selectedSchedule.specificDate ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'}">
                            <i class="fas {selectedSchedule.specificDate ? 'fa-calendar-day' : 'fa-sync-alt'} mr-1"></i>
                            {getScheduleType(selectedSchedule)}
                        </span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <div class="flex items-center">
                            <i class="fas fa-clock w-5 mr-2"></i>
                            <span>{selectedSchedule.startTime} - {selectedSchedule.endTime}</span>
                        </div>
                        <div class="flex items-center">
                            <i class="fas {selectedSchedule.specificDate ? 'fa-calendar-day' : 'fa-calendar-week'} w-5 mr-2"></i>
                            <span>{getScheduleLabel(selectedSchedule)}</span>
                        </div>
                        <div class="flex items-center">
                            <i class="fas fa-chalkboard-teacher w-5 mr-2"></i>
                            <span>{selectedSchedule.teacherName}</span>
                        </div>
                    </div>
                </div>

                <!-- Attendance History Table -->
                {#if loadingHistory}
                    <div class="flex items-center justify-center py-12">
                        <i class="fas fa-spinner fa-spin text-3xl text-primary-500"></i>
                    </div>
                {:else if scheduleAttendances.length === 0}
                    <div class="text-center py-12">
                        <i class="fas fa-clipboard-list text-5xl text-gray-300 dark:text-gray-600 mb-3"></i>
                        <p class="text-gray-500 dark:text-gray-400">Belum ada riwayat absensi</p>
                    </div>
                {:else}
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Tanggal & Waktu
                                    </th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Metode
                                    </th>
                                </tr>
                            </thead>
                            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {#each scheduleAttendances as attendance}
                                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td class="px-4 py-3 whitespace-nowrap">
                                            <div class="text-sm text-gray-900 dark:text-white">
                                                {new Date(attendance.checkInTime).toLocaleDateString('id-ID', { 
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400">
                                                {new Date(attendance.checkInTime).toLocaleTimeString('id-ID', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </td>
                                        <td class="px-4 py-3 whitespace-nowrap">
                                            <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full {getStatusColor(attendance.status)}">
                                                {getStatusLabel(attendance.status)}
                                            </span>
                                        </td>
                                        <td class="px-4 py-3 whitespace-nowrap">
                                            <span class="text-sm text-gray-900 dark:text-white">
                                                {#if attendance.method === 'QR'}
                                                    <i class="fas fa-qrcode mr-1"></i>
                                                {:else}
                                                    <i class="fas fa-hand-pointer mr-1"></i>
                                                {/if}
                                                {attendance.method}
                                            </span>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>

                    <!-- Pagination -->
                    {#if totalPages > 1}
                        <div class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                            <div class="flex-1 flex justify-between sm:hidden">
                                <button
                                    on:click={prevPage}
                                    disabled={currentPage === 1}
                                    class="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Sebelumnya
                                </button>
                                <button
                                    on:click={nextPage}
                                    disabled={currentPage === totalPages}
                                    class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Selanjutnya
                                </button>
                            </div>
                            <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div>
                                    <p class="text-sm text-gray-700 dark:text-gray-300">
                                        Halaman <span class="font-medium">{currentPage}</span> dari
                                        <span class="font-medium">{totalPages}</span>
                                    </p>
                                </div>
                                <div>
                                    <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                        <button
                                            on:click={prevPage}
                                            disabled={currentPage === 1}
                                            class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <i class="fas fa-chevron-left"></i>
                                        </button>
                                        {#each Array(totalPages) as _, i}
                                            {#if i + 1 === 1 || i + 1 === totalPages || (i + 1 >= currentPage - 1 && i + 1 <= currentPage + 1)}
                                                <button
                                                    on:click={() => goToPage(i + 1)}
                                                    class="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium {currentPage === i + 1 ? 'z-10 bg-primary-50 dark:bg-primary-900 border-primary-500 text-primary-600 dark:text-primary-300' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}"
                                                >
                                                    {i + 1}
                                                </button>
                                            {:else if i + 1 === currentPage - 2 || i + 1 === currentPage + 2}
                                                <span class="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    ...
                                                </span>
                                            {/if}
                                        {/each}
                                        <button
                                            on:click={nextPage}
                                            disabled={currentPage === totalPages}
                                            class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <i class="fas fa-chevron-right"></i>
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    {/if}
                {/if}
            </div>
        </div>
    </div>
    {/if}
</Layout>
