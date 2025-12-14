<script>
    import Layout from "../../components/Layout.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { onMount, onDestroy } from "svelte";
    import { Html5Qrcode } from "html5-qrcode";

    let stats = null;
    let schedules = [];
    let students = [];
    let attendances = [];
    let loading = true;
    let showManualModal = false;
    let showQRModal = false;
    let selectedSchedule = null;
    let scanner;
    let scanning = false;

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

        try {
            const [studentsRes, attendanceRes] = await Promise.all([
                fetch(`${API_URL}/schedules/${schedule.id}/students`, {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                }),
                fetch(`${API_URL}/attendance?scheduleId=${schedule.id}`, {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                }),
            ]);

            if (studentsRes.ok) students = await studentsRes.json();
            if (attendanceRes.ok) attendances = await attendanceRes.json();

            showManualModal = true;
        } catch (error) {
            alert("Error loading data");
        }
    }

    function getStudentStatus(studentId) {
        const att = attendances.find((a) => a.studentId === studentId);
        return att?.status || null;
    }

    async function markAttendance(studentId, status) {
        try {
            const response = await fetch(`${API_URL}/attendance/manual`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${auth.getToken()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    scheduleId: selectedSchedule.id,
                    studentId,
                    status,
                }),
            });

            if (response.ok) {
                const att = await response.json();
                const index = attendances.findIndex(
                    (a) => a.studentId === studentId,
                );
                if (index >= 0) {
                    attendances[index] = att;
                } else {
                    attendances = [...attendances, att];
                }
            }
        } catch (error) {
            alert("Error marking attendance");
        }
    }

    async function openQRAttendance(schedule) {
        selectedSchedule = schedule;
        showQRModal = true;

        try {
            scanner = new Html5Qrcode("qr-reader-dashboard");
            scanning = true;

            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                async (qrCode) => {
                    await handleQRScan(qrCode);
                },
                () => {},
            );
        } catch (error) {
            alert("Failed to start camera: " + error.message);
            scanning = false;
        }
    }

    async function handleQRScan(qrCode) {
        try {
            const response = await fetch(`${API_URL}/attendance/qr`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${auth.getToken()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    qrCode,
                    scheduleId: selectedSchedule.id,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                alert(`✅ ${data.student.user.name} marked present`);
                await stopQRScanner();
                await fetchStats();
            } else {
                alert(data.error || "Failed to mark attendance");
            }
        } catch (error) {
            alert("Error: " + error.message);
        }
    }

    async function stopQRScanner() {
        if (scanner && scanning) {
            try {
                await scanner.stop();
                scanning = false;
                showQRModal = false;
            } catch (error) {
                console.error("Error stopping scanner:", error);
            }
        }
    }

    onDestroy(async () => {
        await stopQRScanner();
        if (scanner) scanner.clear();
    });
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
                <div
                    class="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600">
                                Total Students
                            </p>
                            <p class="text-3xl font-bold text-gray-900 mt-2">
                                {stats.totalStudents}
                            </p>
                        </div>
                        <div
                            class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"
                        >
                            <i class="fas fa-users text-2xl text-blue-600"></i>
                        </div>
                    </div>
                </div>

                <div
                    class="bg-white rounded-lg shadow p-6 border-l-4 border-green-500"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600">
                                Present Today
                            </p>
                            <p class="text-3xl font-bold text-gray-900 mt-2">
                                {stats.presentCount}
                            </p>
                        </div>
                        <div
                            class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center"
                        >
                            <i
                                class="fas fa-check-circle text-2xl text-green-600"
                            ></i>
                        </div>
                    </div>
                </div>

                <div
                    class="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600">
                                Sick/Permission
                            </p>
                            <p class="text-3xl font-bold text-gray-900 mt-2">
                                {stats.sickCount + stats.permissionCount}
                            </p>
                        </div>
                        <div
                            class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center"
                        >
                            <i
                                class="fas fa-exclamation-triangle text-2xl text-yellow-600"
                            ></i>
                        </div>
                    </div>
                </div>

                <div
                    class="bg-white rounded-lg shadow p-6 border-l-4 border-red-500"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600">
                                Absent Today
                            </p>
                            <p class="text-3xl font-bold text-gray-900 mt-2">
                                {stats.absentCount}
                            </p>
                        </div>
                        <div
                            class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center"
                        >
                            <i class="fas fa-times-circle text-2xl text-red-600"
                            ></i>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Today's Schedules -->
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-calendar-day mr-2"></i>
                    Today's Schedules
                </h3>

                {#if schedules.length === 0}
                    <div class="text-center py-12 text-gray-500">
                        <i class="fas fa-calendar-times text-4xl mb-2"></i>
                        <p>No schedules for today</p>
                    </div>
                {:else}
                    <div
                        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                        {#each schedules as schedule}
                            <div
                                class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                            >
                                <div
                                    class="flex items-start justify-between mb-3"
                                >
                                    <div>
                                        <h4 class="font-semibold text-gray-900">
                                            {schedule.subject}
                                        </h4>
                                        <p class="text-sm text-gray-500">
                                            Class: {schedule.class}
                                        </p>
                                    </div>
                                    <span
                                        class="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs font-medium"
                                    >
                                        {schedule.startTime} - {schedule.endTime}
                                    </span>
                                </div>
                                <div
                                    class="space-y-1 text-sm text-gray-600 mb-4"
                                >
                                    <p>
                                        <i class="fas fa-chalkboard-teacher w-4"
                                        ></i>
                                        {schedule.teacherName}
                                    </p>
                                    <p>
                                        <i class="fas fa-door-open w-4"></i>
                                        Room {schedule.room}
                                    </p>
                                </div>
                                <div class="flex gap-2">
                                    <button
                                        on:click={() =>
                                            openManualAttendance(schedule)}
                                        class="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                    >
                                        <i class="fas fa-clipboard-list"></i>
                                        <span>Manual</span>
                                    </button>
                                    <button
                                        on:click={() =>
                                            openQRAttendance(schedule)}
                                        class="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                    >
                                        <i class="fas fa-qrcode"></i>
                                        <span>QR Scan</span>
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
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
        <div
            class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
            <div class="p-6 border-b border-gray-200">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-xl font-semibold">
                            {selectedSchedule.subject} - {selectedSchedule.class}
                        </h3>
                        <p class="text-sm text-gray-500">
                            {selectedSchedule.startTime} - {selectedSchedule.endTime}
                        </p>
                    </div>
                    <button
                        on:click={() => (showManualModal = false)}
                        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                    >
                        Close
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-6">
                <table class="min-w-full">
                    <thead class="bg-gray-50 sticky top-0">
                        <tr>
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Student</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >ID</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Status</th
                            >
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        {#each students as student}
                            {@const currentStatus = getStudentStatus(
                                student.id,
                            )}
                            <tr>
                                <td
                                    class="px-4 py-3 text-sm font-medium text-gray-900"
                                    >{student.user.name}</td
                                >
                                <td class="px-4 py-3 text-sm text-gray-500"
                                    >{student.studentId}</td
                                >
                                <td class="px-4 py-3">
                                    <div class="flex gap-2">
                                        <button
                                            on:click={() =>
                                                markAttendance(
                                                    student.id,
                                                    "PRESENT",
                                                )}
                                            class="px-3 py-1 rounded-lg text-xs font-medium transition-colors {currentStatus ===
                                            'PRESENT'
                                                ? 'bg-green-500 text-white'
                                                : 'bg-green-50 text-green-700 hover:bg-green-100'}"
                                        >
                                            Hadir
                                        </button>
                                        <button
                                            on:click={() =>
                                                markAttendance(
                                                    student.id,
                                                    "SICK",
                                                )}
                                            class="px-3 py-1 rounded-lg text-xs font-medium transition-colors {currentStatus ===
                                            'SICK'
                                                ? 'bg-yellow-500 text-white'
                                                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}"
                                        >
                                            Sakit
                                        </button>
                                        <button
                                            on:click={() =>
                                                markAttendance(
                                                    student.id,
                                                    "PERMISSION",
                                                )}
                                            class="px-3 py-1 rounded-lg text-xs font-medium transition-colors {currentStatus ===
                                            'PERMISSION'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}"
                                        >
                                            Izin
                                        </button>
                                        <button
                                            on:click={() =>
                                                markAttendance(
                                                    student.id,
                                                    "ABSENT",
                                                )}
                                            class="px-3 py-1 rounded-lg text-xs font-medium transition-colors {currentStatus ===
                                            'ABSENT'
                                                ? 'bg-red-500 text-white'
                                                : 'bg-red-50 text-red-700 hover:bg-red-100'}"
                                        >
                                            Alfa
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
{/if}

<!-- QR Scanner Modal -->
{#if showQRModal && selectedSchedule}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
        <div class="bg-white rounded-lg max-w-2xl w-full p-6">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="text-xl font-semibold">
                        {selectedSchedule.subject} - {selectedSchedule.class}
                    </h3>
                    <p class="text-sm text-gray-500">
                        Scan QR Code to Mark Attendance
                    </p>
                </div>
                <button
                    on:click={stopQRScanner}
                    class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                >
                    <i class="fas fa-stop mr-2"></i>
                    Stop
                </button>
            </div>
            <div
                id="qr-reader-dashboard"
                class="rounded-lg overflow-hidden"
            ></div>
        </div>
    </div>
{/if}
