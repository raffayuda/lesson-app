<script>
    import Layout from "../../components/Layout.svelte";
    import Modal from "../../components/Modal.svelte";
    import LoadingOverlay from "../../components/LoadingOverlay.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { toastStore } from "../../stores/toast.js";
    import { onMount } from "svelte";
    import QRCode from "qrcode";

    let schedules = [];
    let allStudents = [];
    let loading = true;
    let showModal = false;
    let showQRModal = false;
    let showAttendanceModal = false;
    let editingId = null;
    let submitting = false;
    let processing = false;
    let processingMessage = "Processing...";
    
    // Confirmation modal
    let showConfirmModal = false;
    let confirmModalConfig = {
        title: "",
        message: "",
        onConfirm: () => {},
        danger: false
    };
    let selectedScheduleQR = null;
    let selectedScheduleAttendance = null;
    let qrDataUrl = "";
    let assignedStudentIds = [];
    let searchQuery = "";
    let enrolledStudents = [];
    let attendanceStatuses = {}; // { studentId: 'PRESENT' | 'SICK' | 'PERMISSION' | 'ABSENT' }
    let savingAttendance = false;

    let form = {
        subject: "",
        class: "",
        day: "Monday",
        startTime: "",
        endTime: "",
        teacherName: "",
        room: "",
    };

    const days = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ];

    onMount(() => {
        fetchSchedules();
        fetchAllStudents();
    });

    async function fetchSchedules() {
        loading = true;
        try {
            const response = await fetch(`${API_URL}/schedules`, {
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

    async function fetchAllStudents() {
        try {
            const response = await fetch(`${API_URL}/students`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });
            if (response.ok) {
                allStudents = await response.json();
            }
        } catch (error) {
            console.error("Error:", error);
        }
    }

    async function openModal(schedule = null) {
        if (schedule) {
            editingId = schedule.id;
            form = { ...schedule };

            // Fetch assigned students
            try {
                const response = await fetch(
                    `${API_URL}/schedules/${schedule.id}/students`,
                    {
                        headers: { Authorization: `Bearer ${auth.getToken()}` },
                    },
                );

                if (response.ok) {
                    const assigned = await response.json();
                    assignedStudentIds = assigned.map((s) => s.id);
                }
            } catch (error) {
                console.error("Error:", error);
            }
        } else {
            editingId = null;
            form = {
                subject: "",
                class: "",
                day: "Monday",
                startTime: "",
                endTime: "",
                teacherName: "",
                room: "",
            };
            assignedStudentIds = [];
        }
        searchQuery = "";
        showModal = true;
    }

    async function handleSubmit() {
        submitting = true;
        try {
            const url = editingId
                ? `${API_URL}/schedules/${editingId}`
                : `${API_URL}/schedules`;
            const method = editingId ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${auth.getToken()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...form,
                    studentIds: assignedStudentIds,
                }),
            });

            if (response.ok) {
                showModal = false;
                fetchSchedules();
                toastStore.success(
                    editingId
                        ? "Schedule updated successfully!"
                        : "Schedule created successfully!"
                );
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Failed to save schedule");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        } finally {
            submitting = false;
        }
    }

    function confirmDeleteSchedule(id) {
        confirmModalConfig = {
            title: "Delete Schedule",
            message: "Are you sure you want to delete this schedule? This action cannot be undone.",
            onConfirm: () => deleteSchedule(id),
            danger: true
        };
        showConfirmModal = true;
    }

    async function deleteSchedule(id) {
        processing = true;
        processingMessage = "Deleting schedule...";
        try {
            const response = await fetch(`${API_URL}/schedules/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (response.ok) {
                await fetchSchedules();
                toastStore.success("Schedule deleted successfully!");
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Failed to delete schedule");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        } finally {
            processing = false;
        }
    }

    function toggleStudent(studentId) {
        if (assignedStudentIds.includes(studentId)) {
            assignedStudentIds = assignedStudentIds.filter(
                (id) => id !== studentId,
            );
        } else {
            assignedStudentIds = [...assignedStudentIds, studentId];
        }
    }

    async function viewScheduleQR(schedule) {
        selectedScheduleQR = schedule;
        try {
            qrDataUrl = await QRCode.toDataURL(schedule.qrCode, {
                width: 300,
                margin: 2,
            });
            showQRModal = true;
        } catch (error) {
            toastStore.error("Error generating QR code");
        }
    }

    function downloadQR() {
        const link = document.createElement("a");
        link.download = `schedule-${selectedScheduleQR.subject}-${selectedScheduleQR.class}.png`;
        link.href = qrDataUrl;
        link.click();
    }

    async function openAttendanceModal(schedule) {
        selectedScheduleAttendance = schedule;
        attendanceStatuses = {};

        try {
            // Fetch enrolled students for this schedule
            const response = await fetch(
                `${API_URL}/schedules/${schedule.id}/students`,
                {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                },
            );

            if (response.ok) {
                enrolledStudents = await response.json();

                // Fetch existing attendance for today
                const today = new Date().toISOString().split("T")[0];
                const attResponse = await fetch(
                    `${API_URL}/attendance?scheduleId=${schedule.id}&date=${today}`,
                    {
                        headers: { Authorization: `Bearer ${auth.getToken()}` },
                    },
                );

                if (attResponse.ok) {
                    const existingAtt = await attResponse.json();
                    // Pre-fill existing statuses
                    existingAtt.forEach((att) => {
                        attendanceStatuses[att.studentId] = att.status;
                    });
                    // Trigger reactivity
                    attendanceStatuses = {...attendanceStatuses};
                }

                showAttendanceModal = true;
            }
        } catch (error) {
            toastStore.error("Error loading students: " + error.message);
        }
    }

    async function saveAttendance() {
        savingAttendance = true;

        try {
            const promises = Object.entries(attendanceStatuses).map(
                ([studentId, status]) => {
                    return fetch(`${API_URL}/attendance/manual`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${auth.getToken()}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            scheduleId: selectedScheduleAttendance.id,
                            studentId,
                            status,
                        }),
                    });
                },
            );

            await Promise.all(promises);
            toastStore.success("Attendance saved successfully!");
            showAttendanceModal = false;
            // Reset attendance statuses
            attendanceStatuses = {};
            // Optionally refetch schedules to update stats
            await fetchSchedules();
        } catch (error) {
            toastStore.error("Error saving attendance: " + error.message);
        } finally {
            savingAttendance = false;
        }
    }

    $: filteredStudents = allStudents.filter((s) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            s.user.name.toLowerCase().includes(query) ||
            s.studentId.toLowerCase().includes(query) ||
            s.class.toLowerCase().includes(query)
        );
    });
</script>

<Layout activePage="/schedules" title="Schedules Management">
    <div class="space-y-6">
        <div class="flex justify-between items-center">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white"><i class="fas fa-calendar-alt mr-2 text-primary-600"></i>Jadwal</h2>
            <button
                on:click={() => openModal()}
                class="px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300"
            >
                <i class="fas fa-plus"></i>
                <span>Tambah Jadwal</span>
            </button>
        </div>

        {#if loading}
            <div class="flex justify-center py-20">
                <i class="fas fa-spinner fa-spin text-4xl text-primary-500"></i>
            </div>
        {:else}
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-x-auto border border-gray-200 dark:border-gray-700">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                >Mata Pelajaran</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                >Kelas</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                >Hari</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                >Waktu</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                >Guru</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                >Ruangan</th
                            >
                            <th
                                class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                >Aksi</th
                            >
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {#each schedules as schedule}
                            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
                                    >{schedule.subject}</td
                                >
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
                                    >{schedule.class}</td
                                >
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
                                    >{schedule.day}</td
                                >
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
                                    >{schedule.startTime} - {schedule.endTime}</td
                                >
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
                                    >{schedule.teacherName}</td
                                >
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
                                    >{schedule.room}</td
                                >
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2"
                                >
                                    <button
                                        on:click={() =>
                                            openAttendanceModal(schedule)}
                                        class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                        title="Manual Attendance"
                                    >
                                        <i class="fas fa-clipboard-list"></i>
                                    </button>
                                    <button
                                        on:click={() =>
                                            viewScheduleQR(schedule)}
                                        class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                                        title="View QR Code"
                                    >
                                        <i class="fas fa-qrcode"></i>
                                    </button>
                                    <button
                                        on:click={() => openModal(schedule)}
                                        class="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                                        title="Edit"
                                    >
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button
                                        on:click={() =>
                                            confirmDeleteSchedule(schedule.id)}
                                        class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                        title="Delete"
                                    >
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        {:else}
                            <tr>
                                <td
                                    colspan="7"
                                    class="px-6 py-12 text-center text-gray-500"
                                >
                                    <i
                                        class="fas fa-calendar-times text-4xl mb-2"
                                    ></i>
                                    <p>
                                        No schedules yet. Add your first
                                        schedule!
                                    </p>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>
</Layout>

<!-- Schedule Form Modal -->
{#if showModal}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6"
        >
            <h3 class="text-xl font-semibold mb-4">
                {editingId ? "Edit" : "Add"} Schedule
            </h3>

            <form on:submit|preventDefault={handleSubmit} class="space-y-6">
                <!-- Schedule Info -->
                <div>
                    <h4
                        class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 uppercase"
                    >
                        Schedule Information
                    </h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                                >Subject</label
                            >
                            <input
                                bind:value={form.subject}
                                required
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                                >Class</label
                            >
                            <input
                                bind:value={form.class}
                                required
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                                >Day</label
                            >
                            <select
                                bind:value={form.day}
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                            >
                                {#each days as day}
                                    <option value={day}>{day}</option>
                                {/each}
                            </select>
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                                >Room</label
                            >
                            <input
                                bind:value={form.room}
                                required
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                                >Start Time</label
                            >
                            <input
                                type="time"
                                bind:value={form.startTime}
                                required
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                                >End Time</label
                            >
                            <input
                                type="time"
                                bind:value={form.endTime}
                                required
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div class="col-span-2">
                            <label
                                class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                                >Teacher Name</label
                            >
                            <input
                                bind:value={form.teacherName}
                                required
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>
                </div>

                <!-- Assign Students -->
                <div class="border-t border-gray-200 pt-6">
                    <h4
                        class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 uppercase"
                    >
                        <i class="fas fa-users mr-2"></i>
                        Assign Students ({assignedStudentIds.length} selected)
                    </h4>

                    {#if allStudents.length === 0}
                        <div
                            class="p-8 text-center text-gray-500 bg-gray-50 rounded-lg"
                        >
                            <i class="fas fa-users-slash text-4xl mb-2"></i>
                            <p>
                                No students available. Please add students
                                first.
                            </p>
                        </div>
                    {:else}
                        <div class="mb-3">
                            <input
                                type="text"
                                bind:value={searchQuery}
                                placeholder="Search students by name, ID, or class..."
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                        </div>
                        <div
                            class="max-h-60 overflow-y-auto border border-gray-200 dark:bg-gray-700 dark:border-gray-600 rounded-lg"
                        >
                            <div class="divide-y divide-gray-200">
                                {#each filteredStudents as student}
                                    <label
                                        class="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={assignedStudentIds.includes(
                                                student.id,
                                            )}
                                            on:change={() =>
                                                toggleStudent(student.id)}
                                            class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                        />
                                        <div class="ml-3 flex-1">
                                            <p
                                                class="text-sm font-medium text-gray-900 dark:text-gray-200"
                                            >
                                                {student.user.name}
                                            </p>
                                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                                Class:
                                                {student.class}
                                            </p>
                                        </div>
                                    </label>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>

                <div
                    class="flex gap-3 justify-end pt-4 border-t border-gray-200"
                >
                    <button
                        type="button"
                        on:click={() => (showModal = false)}
                        disabled={submitting}
                        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {#if submitting}
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Saving...</span>
                        {:else}
                            <i class="fas fa-save"></i>
                            <span>Save Schedule</span>
                        {/if}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<!-- Manual Attendance Modal -->
{#if showAttendanceModal && selectedScheduleAttendance}
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl transform transition-all"
        >
            <div class="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-gray-700 dark:to-gray-800">
                <div class="flex items-start justify-between">
                    <div>
                        <h3 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <i class="fas fa-clipboard-check text-primary-600"></i>
                            Manual Attendance
                        </h3>
                        <p class="text-sm text-gray-600 dark:text-gray-300 mt-2">
                            <span class="font-medium">{selectedScheduleAttendance.subject}</span> - {selectedScheduleAttendance.class}
                        </p>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <i class="fas fa-calendar-alt mr-1"></i>
                            {selectedScheduleAttendance.day}, {selectedScheduleAttendance.startTime}
                            - {selectedScheduleAttendance.endTime}
                        </p>
                    </div>
                    <button
                        on:click={() => (showAttendanceModal = false)}
                        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
                {#if enrolledStudents.length === 0}
                    <div class="text-center py-12 text-gray-500 dark:text-gray-400">
                        <div class="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-users-slash text-4xl text-gray-400 dark:text-gray-500"></i>
                        </div>
                        <p class="font-medium">No students enrolled in this schedule</p>
                        <p class="text-sm mt-1">Please assign students first</p>
                    </div>
                    {:else}
                    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                        <table class="min-w-full">
                            <thead class="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                    <th
                                        class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                                        >Murid</th
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
                </div>
                {/if}
            </div>

            <div class="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                <button
                    on:click={() => (showAttendanceModal = false)}
                    class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors flex items-center gap-2"
                    disabled={savingAttendance}
                >
                    <i class="fas fa-times"></i>
                    <span>Cancel</span>
                </button>
                <button
                    on:click={saveAttendance}
                    class="px-6 py-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2"
                    disabled={savingAttendance ||
                        Object.keys(attendanceStatuses).length === 0}
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
                        {selectedScheduleQR.day}, {selectedScheduleQR.startTime}
                        - {selectedScheduleQR.endTime}
                    </p>
                </div>
                
                <div
                    class="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl text-sm text-blue-700 dark:text-blue-300"
                >
                    <i class="fas fa-info-circle mr-2"></i>
                    <span class="font-medium">Students scan this QR to mark attendance</span>
                </div>
                
                <button
                    on:click={downloadQR}
                    class="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                    <i class="fas fa-download"></i>
                    <span>Download QR Code</span>
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
