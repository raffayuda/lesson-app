<script>
    import Layout from "../../components/Layout.svelte";
    import StatsCard from "../../components/StatsCard.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { toastStore } from "../../stores/toast.js";
    import { onMount } from "svelte";
    import QRCode from "qrcode";

    let stats = null;
    let schedules = [];
    let enrolledStudents = [];
    let attendanceStatuses = {};
    let originalAttendanceStatuses = {}; // Track original values from DB
    let modifiedStudents = new Set(); // Track which students were actually modified
    let currentAttendanceDate = null;
    let loading = true;
    let showManualModal = false;
    let showQRModal = false;
    let selectedSchedule = null;
    let selectedScheduleQR = null;
    let qrDataUrl = "";
    let savingAttendance = false;

    onMount(async () => {
        await fetchStats();
        await fetchTodaySchedules();
    });

    async function fetchStats() {
        try {
            const response = await fetch(`${API_URL}/stats/today`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (response.ok) {
                stats = await response.json();
            }
        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            loading = false;
        }
    }

    async function fetchTodaySchedules() {
        try {
            const response = await fetch(`${API_URL}/schedules/today`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (response.ok) {
                schedules = await response.json();
            }
        } catch (error) {
            console.error("Error:", error);
        }
    }

    async function openManualAttendance(schedule) {
        selectedSchedule = schedule;
        attendanceStatuses = {};
        originalAttendanceStatuses = {}; // Reset original
        modifiedStudents = new Set(); // Reset modified tracking
        
        // Show modal immediately
        showManualModal = true;
        enrolledStudents = []; // Show empty state while loading

        try {
            const today = new Date().toISOString().split("T")[0];
            currentAttendanceDate = today; // Store the date for saving
            
            // Fetch students and attendance in parallel for better performance
            const [studentsResponse, attendanceResponse] = await Promise.all([
                fetch(`${API_URL}/schedules/${schedule.id}/students`, {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                }),
                fetch(`${API_URL}/attendance?scheduleId=${schedule.id}&date=${today}`, {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                })
            ]);

            if (studentsResponse.ok) {
                enrolledStudents = await studentsResponse.json();
            }
            
            if (attendanceResponse.ok) {
                const existingAtt = await attendanceResponse.json();
                console.log('Existing attendance loaded:', existingAtt);
                
                // Build new object to ensure reactivity
                const newStatuses = {};
                const newOriginal = {};
                existingAtt.forEach((att) => {
                    newStatuses[att.studentId] = att.status;
                    newOriginal[att.studentId] = att.status;
                });
                
                attendanceStatuses = newStatuses;
                originalAttendanceStatuses = newOriginal;
                console.log('Attendance statuses set:', attendanceStatuses);
            }
        } catch (error) {
            toastStore.error("Error loading students: " + error.message);
            showManualModal = false;
        }
    }

    async function saveAttendance() {
        savingAttendance = true;

        try {
            // Only send attendance updates for modified students
            const promises = Array.from(modifiedStudents).map(
                (studentId) => {
                    const status = attendanceStatuses[studentId];
                    return fetch(`${API_URL}/attendance/manual`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${auth.getToken()}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            scheduleId: selectedSchedule.id,
                            studentId,
                            status,
                            date: currentAttendanceDate,
                        }),
                    });
                },
            );

            await Promise.all(promises);
            
            showManualModal = false;
            attendanceStatuses = {};
            originalAttendanceStatuses = {};
            modifiedStudents = new Set();
            toastStore.success("Absensi berhasil disimpan!");
            
            // Refresh stats to show updated data
            fetchStats();
        } catch (error) {
            toastStore.error("Error saving attendance: " + error.message);
        } finally {
            savingAttendance = false;
        }
    }

    async function openQRCode(schedule) {
        selectedScheduleQR = schedule;

        try {
            qrDataUrl = await QRCode.toDataURL(schedule.qrCode, {
                width: 300,
                margin: 2,
                color: {
                    dark: "#1e40af",
                    light: "#ffffff",
                },
            });
            showQRModal = true;
        } catch (error) {
            toastStore.error("Failed to generate QR code: " + error.message);
        }
    }

    async function downloadQRCode() {
        try {
            const link = document.createElement("a");
            link.download = `QR-${selectedScheduleQR.subject}-${selectedScheduleQR.class}.png`;
            link.href = qrDataUrl;
            link.click();
            toastStore.success("QR Code downloaded!");
        } catch (error) {
            toastStore.error("Failed to download QR code");
        }
    }
</script>

<Layout activePage="/" title="Dashboard">
    <div class="space-y-6">
        <!-- Stats Grid -->
        {#if loading}
            <div class="flex items-center justify-center py-20">
                <i class="fas fa-spinner fa-spin text-4xl text-primary-500"></i>
            </div>
        {:else if stats}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Total Siswa"
                    value={stats.totalStudents}
                    icon="fa-users"
                    color="blue"
                />
                <StatsCard
                    title="Hadir Hari Ini"
                    value={stats.presentCount}
                    icon="fa-check-circle"
                    color="green"
                />
                <StatsCard
                    title="Sakit/Izin"
                    value={stats.sickCount + stats.permissionCount}
                    icon="fa-exclamation-triangle"
                    color="orange"
                />
                <StatsCard
                    title="Alfa Hari Ini"
                    value={stats.absentCount}
                    icon="fa-times-circle"
                    color="red"
                />
            </div>

            <!-- Today's Schedules -->
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    <i class="fas fa-calendar-day mr-2 text-primary-600"></i>
                    Jadwal Hari Ini
                </h3>

                {#if schedules.length === 0}
                    <div class="text-center py-12 text-gray-500 dark:text-gray-400">
                        <i class="fas fa-calendar-times text-4xl mb-2"></i>
                        <p>Tidak ada jadwal hari ini</p>
                    </div>
                {:else}
                    <div
                        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                        {#each schedules as schedule}
                            <div
                                class="border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:shadow-lg dark:hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 hover:scale-[1.02]"
                            >
                                <div
                                    class="flex items-start justify-between mb-3"
                                >
                                    <div>
                                        <h4 class="font-semibold text-gray-900 dark:text-white">
                                            {schedule.subject}
                                        </h4>
                                    </div>
                                    <span
                                        class="px-2 py-1 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg text-xs font-medium shadow-md"
                                    >
                                        {schedule.startTime} - {schedule.endTime}
                                    </span>
                                </div>
                                <div
                                    class="space-y-1 text-sm text-gray-600 dark:text-gray-300 mb-4"
                                >
                                    <p>
                                        <i class="fas fa-chalkboard-teacher w-4"
                                        ></i>
                                        {schedule.teacherName}
                                    </p>
                                    <p>
                                        <i class="fas fa-door-open w-4"></i>
                                        Ruangan {schedule.room}
                                    </p>
                                </div>
                                <div class="flex gap-2">
                                    <button
                                        on:click={() =>
                                            openManualAttendance(schedule)}
                                        class="flex-1 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-300"
                                    >
                                        <i class="fas fa-clipboard-list"></i>
                                        <span>Manual</span>
                                    </button>
                                    <button
                                        on:click={() =>
                                            openQRCode(schedule)}
                                        class="flex-1 px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-300"
                                    >
                                        <i class="fas fa-qrcode"></i>
                                        <span>QR Code</span>
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</Layout>

<!-- Manual Attendance Modal -->
{#if showManualModal && selectedSchedule}
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        >
            <div class="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-gray-700 dark:to-gray-800">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                            {selectedSchedule.subject} - {selectedSchedule.class}
                        </h3>
                        <p class="text-sm text-gray-600 dark:text-gray-300">
                            {selectedSchedule.startTime} - {selectedSchedule.endTime}
                        </p>
                    </div>
                    <button
                        on:click={() => (showManualModal = false)}
                        class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-6">
                {#if enrolledStudents.length === 0}
                    <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                        <i class="fas fa-users text-4xl mb-2"></i>
                        <p>No students enrolled in this schedule</p>
                    </div>
                {:else}
                <table class="min-w-full">
                    <thead class="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                                >Siswa</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                                >Kelas</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                                >Status</th
                            >
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {#each enrolledStudents as student}
                            <tr>
                                <td
                                    class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white"
                                    >{student.user.name}</td
                                >
                                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-300"
                                    >{student.class}</td
                                >
                                <td class="px-4 py-3">
                                    <div class="flex gap-2">
                                        <button
                                            type="button"
                                            on:click={() => {
                                                attendanceStatuses[student.id] = 'PRESENT';
                                                modifiedStudents.add(student.id);
                                                modifiedStudents = modifiedStudents; // Force reactivity
                                                attendanceStatuses = {...attendanceStatuses};
                                            }}
                                            class="w-10 h-10 rounded-full border-2 flex items-center justify-center font-semibold transition-all {attendanceStatuses[student.id] === 'PRESENT' ? 'bg-green-500 border-green-600 text-white' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-green-500'}"
                                            title="Hadir"
                                        >
                                            H
                                        </button>
                                        <button
                                            type="button"
                                            on:click={() => {
                                                attendanceStatuses[student.id] = 'SICK';
                                                modifiedStudents.add(student.id);
                                                modifiedStudents = modifiedStudents; // Force reactivity
                                                attendanceStatuses = {...attendanceStatuses};
                                            }}
                                            class="w-10 h-10 rounded-full border-2 flex items-center justify-center font-semibold transition-all {attendanceStatuses[student.id] === 'SICK' ? 'bg-yellow-500 border-yellow-600 text-white' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-yellow-500'}"
                                            title="Sakit"
                                        >
                                            S
                                        </button>
                                        <button
                                            type="button"
                                            on:click={() => {
                                                attendanceStatuses[student.id] = 'PERMISSION';
                                                modifiedStudents.add(student.id);
                                                modifiedStudents = modifiedStudents; // Force reactivity
                                                attendanceStatuses = {...attendanceStatuses};
                                            }}
                                            class="w-10 h-10 rounded-full border-2 flex items-center justify-center font-semibold transition-all {attendanceStatuses[student.id] === 'PERMISSION' ? 'bg-blue-500 border-blue-600 text-white' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-500'}"
                                            title="Izin"
                                        >
                                            I
                                        </button>
                                        <button
                                            type="button"
                                            on:click={() => {
                                                attendanceStatuses[student.id] = 'ABSENT';
                                                modifiedStudents.add(student.id);
                                                modifiedStudents = modifiedStudents; // Force reactivity
                                                attendanceStatuses = {...attendanceStatuses};
                                            }}
                                            class="w-10 h-10 rounded-full border-2 flex items-center justify-center font-semibold transition-all {attendanceStatuses[student.id] === 'ABSENT' ? 'bg-red-500 border-red-600 text-white' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-red-500'}"
                                            title="Alfa"
                                        >
                                            A
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
                {/if}
            </div>

            <div class="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
                <button
                    on:click={() => (showManualModal = false)}
                    class="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-all duration-300"
                >
                    <i class="fas fa-times mr-2"></i>
                    Cancel
                </button>
                <button
                    on:click={saveAttendance}
                    class="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={savingAttendance || modifiedStudents.size === 0}
                >
                    {#if savingAttendance}
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Saving...</span>
                    {:else}
                        <i class="fas fa-save"></i>
                        <span>Save Attendance</span>
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- QR Code Modal -->
{#if showQRModal && selectedScheduleQR}
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
        on:click={() => (showQRModal = false)}
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl transform transition-all"
            on:click|stopPropagation
        >
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <i class="fas fa-qrcode text-primary-600"></i>
                    Schedule QR Code
                </h3>
                <button
                    on:click={() => (showQRModal = false)}
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <div class="text-center space-y-4">
                <div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 p-6 rounded-xl inline-block shadow-inner">
                    <img src={qrDataUrl} alt="QR Code" class="w-64 h-64 rounded-lg" />
                </div>
                
                <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <p class="font-semibold text-gray-900 dark:text-white text-lg">
                        {selectedScheduleQR.subject}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        <i class="fas fa-users mr-1"></i>
                        Class: {selectedScheduleQR.class}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-300">
                        <i class="fas fa-clock mr-1"></i>
                        {selectedScheduleQR.startTime} - {selectedScheduleQR.endTime}
                    </p>
                </div>
                
                <button
                    on:click={downloadQRCode}
                    class="w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
                >
                    <i class="fas fa-download"></i>
                    Download QR Code
                </button>
            </div>
        </div>
    </div>
{/if}
