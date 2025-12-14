<script>
    import Layout from "../../components/Layout.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { onMount } from "svelte";
    import QRCode from "qrcode";

    let schedules = [];
    let allStudents = [];
    let loading = true;
    let showModal = false;
    let showQRModal = false;
    let showAttendanceModal = false;
    let editingId = null;
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
            } else {
                const data = await response.json();
                alert(data.error || "Failed to save schedule");
            }
        } catch (error) {
            alert("Error: " + error.message);
        }
    }

    async function deleteSchedule(id) {
        if (!confirm("Delete this schedule?")) return;

        try {
            const response = await fetch(`${API_URL}/schedules/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (response.ok) {
                fetchSchedules();
            }
        } catch (error) {
            alert("Error: " + error.message);
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
            alert("Error generating QR code");
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
                }

                showAttendanceModal = true;
            }
        } catch (error) {
            alert("Error loading students: " + error.message);
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
            alert("Attendance saved successfully!");
            showAttendanceModal = false;
        } catch (error) {
            alert("Error saving attendance: " + error.message);
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
            <h2 class="text-2xl font-bold text-gray-900">Class Schedules</h2>
            <button
                on:click={() => openModal()}
                class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2"
            >
                <i class="fas fa-plus"></i>
                <span>Add Schedule</span>
            </button>
        </div>

        {#if loading}
            <div class="flex justify-center py-20">
                <i class="fas fa-spinner fa-spin text-4xl text-primary-500"></i>
            </div>
        {:else}
            <div class="bg-white rounded-lg shadow overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Subject</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Class</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Day</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Time</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Teacher</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Room</th
                            >
                            <th
                                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                                >Actions</th
                            >
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        {#each schedules as schedule}
                            <tr class="hover:bg-gray-50">
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                                    >{schedule.subject}</td
                                >
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                    >{schedule.class}</td
                                >
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                    >{schedule.day}</td
                                >
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                    >{schedule.startTime} - {schedule.endTime}</td
                                >
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                    >{schedule.teacherName}</td
                                >
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                    >{schedule.room}</td
                                >
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2"
                                >
                                    <button
                                        on:click={() =>
                                            openAttendanceModal(schedule)}
                                        class="text-blue-600 hover:text-blue-900"
                                        title="Manual Attendance"
                                    >
                                        <i class="fas fa-clipboard-list"></i>
                                    </button>
                                    <button
                                        on:click={() =>
                                            viewScheduleQR(schedule)}
                                        class="text-green-600 hover:text-green-900"
                                        title="View QR Code"
                                    >
                                        <i class="fas fa-qrcode"></i>
                                    </button>
                                    <button
                                        on:click={() => openModal(schedule)}
                                        class="text-primary-600 hover:text-primary-900"
                                        title="Edit"
                                    >
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button
                                        on:click={() =>
                                            deleteSchedule(schedule.id)}
                                        class="text-red-600 hover:text-red-900"
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
            class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6"
        >
            <h3 class="text-xl font-semibold mb-4">
                {editingId ? "Edit" : "Add"} Schedule
            </h3>

            <form on:submit|preventDefault={handleSubmit} class="space-y-6">
                <!-- Schedule Info -->
                <div>
                    <h4
                        class="text-sm font-semibold text-gray-700 mb-3 uppercase"
                    >
                        Schedule Information
                    </h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-1"
                                >Subject</label
                            >
                            <input
                                bind:value={form.subject}
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-1"
                                >Class</label
                            >
                            <input
                                bind:value={form.class}
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-1"
                                >Day</label
                            >
                            <select
                                bind:value={form.day}
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            >
                                {#each days as day}
                                    <option value={day}>{day}</option>
                                {/each}
                            </select>
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-1"
                                >Room</label
                            >
                            <input
                                bind:value={form.room}
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-1"
                                >Start Time</label
                            >
                            <input
                                type="time"
                                bind:value={form.startTime}
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-1"
                                >End Time</label
                            >
                            <input
                                type="time"
                                bind:value={form.endTime}
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div class="col-span-2">
                            <label
                                class="block text-sm font-medium text-gray-700 mb-1"
                                >Teacher Name</label
                            >
                            <input
                                bind:value={form.teacherName}
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>
                </div>

                <!-- Assign Students -->
                <div class="border-t border-gray-200 pt-6">
                    <h4
                        class="text-sm font-semibold text-gray-700 mb-3 uppercase"
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
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                        </div>
                        <div
                            class="max-h-60 overflow-y-auto border border-gray-200 rounded-lg"
                        >
                            <div class="divide-y divide-gray-200">
                                {#each filteredStudents as student}
                                    <label
                                        class="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
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
                                                class="text-sm font-medium text-gray-900"
                                            >
                                                {student.user.name}
                                            </p>
                                            <p class="text-xs text-gray-500">
                                                ID: {student.studentId} | Class:
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
                        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                    >
                        <i class="fas fa-save mr-2"></i>
                        Save Schedule
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<!-- Manual Attendance Modal -->
{#if showAttendanceModal && selectedScheduleAttendance}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
        <div
            class="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
            <div class="p-6 border-b border-gray-200">
                <h3 class="text-xl font-semibold">Manual Attendance</h3>
                <p class="text-sm text-gray-500 mt-1">
                    {selectedScheduleAttendance.subject} - {selectedScheduleAttendance.class}
                    |
                    {selectedScheduleAttendance.day}, {selectedScheduleAttendance.startTime}
                    - {selectedScheduleAttendance.endTime}
                </p>
            </div>

            <div class="flex-1 overflow-y-auto p-6">
                {#if enrolledStudents.length === 0}
                    <div class="text-center py-12 text-gray-500">
                        <i class="fas fa-users-slash text-4xl mb-2"></i>
                        <p>No students enrolled in this schedule</p>
                        <p class="text-sm mt-1">Please assign students first</p>
                    </div>
                {:else}
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
                                    >Class</th
                                >
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                    >Status</th
                                >
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            {#each enrolledStudents as student}
                                <tr>
                                    <td
                                        class="px-4 py-3 text-sm font-medium text-gray-900"
                                        >{student.user.name}</td
                                    >
                                    <td class="px-4 py-3 text-sm text-gray-500"
                                        >{student.studentId}</td
                                    >
                                    <td class="px-4 py-3 text-sm text-gray-500"
                                        >{student.class}</td
                                    >
                                    <td class="px-4 py-3">
                                        <select
                                            bind:value={
                                                attendanceStatuses[student.id]
                                            }
                                            class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                                        >
                                            <option value=""
                                                >-- Select --</option
                                            >
                                            <option value="PRESENT"
                                                >Hadir</option
                                            >
                                            <option value="SICK">Sakit</option>
                                            <option value="PERMISSION"
                                                >Izin</option
                                            >
                                            <option value="ABSENT">Alfa</option>
                                        </select>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {/if}
            </div>

            <div class="p-6 border-t border-gray-200 flex gap-3 justify-end">
                <button
                    on:click={() => (showAttendanceModal = false)}
                    class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg"
                    disabled={savingAttendance}
                >
                    Cancel
                </button>
                <button
                    on:click={saveAttendance}
                    class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
                    disabled={savingAttendance ||
                        Object.keys(attendanceStatuses).length === 0}
                >
                    {#if savingAttendance}
                        <i class="fas fa-spinner fa-spin mr-2"></i>
                        Saving...
                    {:else}
                        <i class="fas fa-save mr-2"></i>
                        Save Attendance
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- QR Code Modal -->
{#if showQRModal && selectedScheduleQR}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        on:click={() => (showQRModal = false)}
    >
        <div
            class="bg-white rounded-lg max-w-sm w-full p-6"
            on:click|stopPropagation
        >
            <h3 class="text-xl font-semibold mb-4">Schedule QR Code</h3>
            <div class="text-center space-y-4">
                <div class="bg-white p-4 rounded-lg inline-block">
                    <img src={qrDataUrl} alt="QR Code" class="w-64 h-64" />
                </div>
                <div>
                    <p class="font-semibold text-gray-900">
                        {selectedScheduleQR.subject}
                    </p>
                    <p class="text-sm text-gray-500">
                        Class: {selectedScheduleQR.class}
                    </p>
                    <p class="text-sm text-gray-500">
                        {selectedScheduleQR.day}, {selectedScheduleQR.startTime}
                        - {selectedScheduleQR.endTime}
                    </p>
                </div>
                <div
                    class="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700"
                >
                    <i class="fas fa-info-circle mr-1"></i>
                    Students scan this QR to mark attendance
                </div>
                <button
                    on:click={downloadQR}
                    class="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                >
                    <i class="fas fa-download mr-2"></i>
                    Download QR Code
                </button>
            </div>
        </div>
    </div>
{/if}
