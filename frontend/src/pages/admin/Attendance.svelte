<script>
    import Layout from "../../components/Layout.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { toastStore } from "../../stores/toast.js";
    import { onMount, onDestroy } from "svelte";
    import { Html5Qrcode } from "html5-qrcode";

    let schedules = [];
    let students = [];
    let attendances = [];
    let loading = true;
    let showModal = false;
    let showQRScanner = false;
    let selectedSchedule = null;
    let scanner;
    let scanning = false;

    const statuses = [
        { value: "PRESENT", label: "Hadir", color: "green" },
        { value: "SICK", label: "Sakit", color: "yellow" },
        { value: "PERMISSION", label: "Izin", color: "blue" },
        { value: "ABSENT", label: "Alfa", color: "red" },
    ];

    onMount(() => {
        fetchTodaySchedules();
    });

    async function fetchTodaySchedules() {
        loading = true;
        try {
            const response = await fetch(`${API_URL}/schedules/today`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });
            if (response.ok) {
                schedules = await response.json();
            }
        } catch (error) {
            console.error("Error:", error);
        } finally {
            loading = false;
        }
    }

    async function openAttendance(schedule) {
        selectedSchedule = schedule;

        // Fetch students in this class
        try {
            const [studentsRes, attendanceRes] = await Promise.all([
                fetch(`${API_URL}/students?class=${schedule.class}`, {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                }),
                fetch(`${API_URL}/attendance?scheduleId=${schedule.id}`, {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                }),
            ]);

            if (studentsRes.ok) students = await studentsRes.json();
            if (attendanceRes.ok) attendances = await attendanceRes.json();

            showModal = true;
        } catch (error) {
            toastStore.error("Error loading data");
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
                // Update local attendances
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
            toastStore.error("Error marking attendance");
        }
    }

    async function startQRScanner() {
        try {
            scanner = new Html5Qrcode("qr-reader-attendance");
            scanning = true;
            showQRScanner = true;

            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                async (qrCode) => {
                    await handleQRScan(qrCode);
                },
                () => {},
            );
        } catch (error) {
            toastStore.error("Failed to start camera: " + error.message);
            scanning = false;
        }
    }

    async function stopQRScanner() {
        if (scanner && scanning) {
            try {
                await scanner.stop();
                scanning = false;
                showQRScanner = false;
            } catch (error) {
                console.error("Error stopping scanner:", error);
            }
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
                attendances = [...attendances, data];
                toastStore.success(`✅ ${data.student.user.name} marked present`);
                await stopQRScanner();
            } else {
                toastStore.error(data.error || "Failed to mark attendance");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        }
    }

    onDestroy(async () => {
        await stopQRScanner();
        if (scanner) scanner.clear();
    });
</script>

<Layout activePage="/attendance" title="Attendance Management">
    <div class="space-y-6">
        <h2 class="text-2xl font-bold text-gray-900">Today's Schedules</h2>

        {#if loading}
            <div class="flex justify-center py-20">
                <i class="fas fa-spinner fa-spin text-4xl text-primary-500"></i>
            </div>
        {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {#each schedules as schedule}
                    <button
                        on:click={() => openAttendance(schedule)}
                        class="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
                    >
                        <div class="flex items-start justify-between mb-3">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-900">
                                    {schedule.subject}
                                </h3>
                                <p class="text-sm text-gray-500">
                                    Class: {schedule.class}
                                </p>
                            </div>
                            <span
                                class="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-medium"
                            >
                                {schedule.startTime} - {schedule.endTime}
                            </span>
                        </div>
                        <div class="space-y-1 text-sm text-gray-600">
                            <p>
                                <i class="fas fa-chalkboard-teacher w-4"></i>
                                {schedule.teacherName}
                            </p>
                            <p>
                                <i class="fas fa-door-open w-4"></i> Room {schedule.room}
                            </p>
                        </div>
                        <div class="mt-4 pt-4 border-t border-gray-200">
                            <p class="text-sm text-gray-500">
                                Click to take attendance
                            </p>
                        </div>
                    </button>
                {:else}
                    <div class="col-span-full text-center py-20 text-gray-500">
                        <i class="fas fa-calendar-times text-4xl mb-2"></i>
                        <p>No schedules for today</p>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</Layout>

{#if showModal && selectedSchedule}
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
                    <div class="flex gap-2">
                        {#if !showQRScanner}
                            <button
                                on:click={startQRScanner}
                                class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm"
                            >
                                <i class="fas fa-qrcode mr-2"></i>
                                Scan QR
                            </button>
                        {:else}
                            <button
                                on:click={stopQRScanner}
                                class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                            >
                                <i class="fas fa-stop mr-2"></i>
                                Stop Scanner
                            </button>
                        {/if}
                        <button
                            on:click={() => (showModal = false)}
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>

            {#if showQRScanner}
                <div class="p-6">
                    <div
                        id="qr-reader-attendance"
                        class="rounded-lg overflow-hidden"
                    ></div>
                </div>
            {/if}

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
                                        {#each statuses as status}
                                            <button
                                                on:click={() =>
                                                    markAttendance(
                                                        student.id,
                                                        status.value,
                                                    )}
                                                class="px-3 py-1 rounded-lg text-xs font-medium transition-colors {currentStatus ===
                                                status.value
                                                    ? `bg-${status.color}-500 text-white`
                                                    : `bg-${status.color}-50 text-${status.color}-700 hover:bg-${status.color}-100`}"
                                            >
                                                {status.label}
                                            </button>
                                        {/each}
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
