<script>
    import Layout from "../../components/Layout.svelte";
    import Modal from "../../components/Modal.svelte";
    import LoadingOverlay from "../../components/LoadingOverlay.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { toastStore } from "../../stores/toast.js";
    import { onMount } from "svelte";
    import Calendar from '@event-calendar/core';
    import DayGrid from '@event-calendar/day-grid';
    import TimeGrid from '@event-calendar/time-grid';
    import Interaction from '@event-calendar/interaction';
    import QRCode from "qrcode";

    let schedules = [];
    let allStudents = [];
    let loading = true;
    let showModal = false;
    let showQRModal = false;
    let showAttendanceModal = false;
    let showDetailModal = false;
    let editingId = null;
    let submitting = false;
    let processing = false;
    let processingMessage = "Processing...";
    
    let calendarEl;
    let ec; // Event Calendar instance
    let selectedScheduleQR = null;
    let selectedScheduleAttendance = null;
    let selectedScheduleDetail = null;
    let qrDataUrl = "";
    let assignedStudentIds = [];
    let searchQuery = "";
    let enrolledStudents = [];
    let attendanceStatuses = {};
    let savingAttendance = false;
    
    // View mode
    let currentView = 'dayGridWeek'; // dayGridWeek, timeGridWeek, dayGridMonth
    
    // Filters
    let filterClass = "";
    let filterTeacher = "";
    let filterSubject = "";
    
    // Confirmation modal
    let showConfirmModal = false;
    let confirmModalConfig = {
        title: "",
        message: "",
        onConfirm: () => {},
        danger: false
    };

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
    
    const dayMapping = {
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6,
        'Sunday': 0
    };

    onMount(() => {
        fetchSchedules();
        fetchAllStudents();
        initCalendar();
    });

    function initCalendar() {
        ec = new Calendar({
            target: calendarEl,
            props: {
                plugins: [DayGrid, TimeGrid, Interaction],
                options: {
                    view: currentView,
                    height: '700px',
                    headerToolbar: {
                        start: 'prev,next today',
                        center: 'title',
                        end: 'dayGridMonth,timeGridWeek,dayGridWeek'
                    },
                    buttonText: {
                        today: 'Today',
                        month: 'Month',
                        week: 'Week',
                        day: 'Day'
                    },
                    events: [],
                    eventClick: handleEventClick,
                    eventColor: '#3b82f6',
                    eventTextColor: '#ffffff',
                    slotMinTime: '07:00:00',
                    slotMaxTime: '18:00:00',
                    allDaySlot: false,
                    nowIndicator: true,
                    editable: false,
                    selectable: false,
                    dayMaxEvents: 3,
                    moreLinkClick: 'popover',
                    views: {
                        dayGridWeek: {
                            titleFormat: { year: 'numeric', month: 'short', day: 'numeric' }
                        }
                    }
                }
            }
        });
    }

    async function fetchSchedules() {
        loading = true;
        try {
            const response = await fetch(`${API_URL}/schedules`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });
            if (response.ok) {
                schedules = await response.json();
                updateCalendarEvents();
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
    
    function updateCalendarEvents() {
        if (!ec) return;
        
        // Convert schedules to calendar events
        const events = schedules
            .filter(schedule => {
                if (filterClass && schedule.class !== filterClass) return false;
                if (filterTeacher && schedule.teacherName !== filterTeacher) return false;
                if (filterSubject && !schedule.subject.toLowerCase().includes(filterSubject.toLowerCase())) return false;
                return true;
            })
            .map(schedule => {
                // Get next occurrence of the day
                const today = new Date();
                const dayOfWeek = dayMapping[schedule.day];
                const daysUntil = (dayOfWeek + 7 - today.getDay()) % 7;
                const nextDate = new Date(today);
                nextDate.setDate(today.getDate() + (daysUntil === 0 ? 7 : daysUntil));
                
                const [startHour, startMinute] = schedule.startTime.split(':');
                const [endHour, endMinute] = schedule.endTime.split(':');
                
                const startDateTime = new Date(nextDate);
                startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0);
                
                const endDateTime = new Date(nextDate);
                endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0);
                
                return {
                    id: schedule.id,
                    title: `${schedule.subject} (${schedule.class})`,
                    start: startDateTime,
                    end: endDateTime,
                    backgroundColor: getClassColor(schedule.class),
                    borderColor: getClassColor(schedule.class),
                    extendedProps: {
                        ...schedule
                    }
                };
            });
        
        ec.setOption('events', events);
    }
    
    function getClassColor(className) {
        const colors = {
            '10': '#ef4444', // red
            '11': '#3b82f6', // blue
            '12': '#10b981', // green
            '12 A': '#f59e0b', // yellow
            '12 B': '#8b5cf6', // purple
            '12 C': '#ec4899', // pink
        };
        return colors[className] || '#6366f1';
    }
    
    function handleEventClick(info) {
        const schedule = info.event.extendedProps;
        selectedScheduleDetail = {
            id: info.event.id,
            ...schedule
        };
        showDetailModal = true;
    }

    async function openModal(schedule = null) {
        if (schedule) {
            editingId = schedule.id;
            form = { ...schedule };

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
                await fetchSchedules();
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
        showDetailModal = false;
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
            showDetailModal = false;
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
        showDetailModal = false;

        try {
            const response = await fetch(
                `${API_URL}/schedules/${schedule.id}/students`,
                {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                },
            );

            if (response.ok) {
                enrolledStudents = await response.json();

                const today = new Date().toISOString().split("T")[0];
                const attResponse = await fetch(
                    `${API_URL}/attendance?scheduleId=${schedule.id}&date=${today}`,
                    {
                        headers: { Authorization: `Bearer ${auth.getToken()}` },
                    },
                );

                if (attResponse.ok) {
                    const existingAtt = await attResponse.json();
                    existingAtt.forEach((att) => {
                        attendanceStatuses[att.studentId] = att.status;
                    });
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
            attendanceStatuses = {};
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
    
    $: uniqueClasses = [...new Set(schedules.map(s => s.class))].sort();
    $: uniqueTeachers = [...new Set(schedules.map(s => s.teacherName))].sort();
    
    // Update calendar when filters change
    $: if (filterClass !== undefined || filterTeacher !== undefined || filterSubject !== undefined) {
        updateCalendarEvents();
    }
</script>

<svelte:head>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@event-calendar/core@3/index.min.css">
</svelte:head>

<Layout activePage="/schedules" title="Manajemen Jadwal">
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h2 class="text-3xl font-bold text-gray-900 dark:text-white">
                    <i class="fas fa-calendar-alt mr-2 text-primary-600"></i>
                    Schedule Calendar
                </h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Manage weekly schedules with interactive calendar view
                </p>
            </div>
            <button
                on:click={() => openModal()}
                class="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
                <i class="fas fa-plus"></i>
                <span class="font-semibold">Add Schedule</span>
            </button>
        </div>

        <!-- Filters -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border border-gray-200 dark:border-gray-700">
            <div class="flex flex-wrap items-center gap-3">
                <div class="flex items-center gap-2">
                    <i class="fas fa-filter text-gray-500 dark:text-gray-400"></i>
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
                </div>
                
                <select 
                    bind:value={filterClass}
                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-primary-500 transition-all"
                >
                    <option value="">All Classes</option>
                    {#each uniqueClasses as cls}
                        <option value={cls}>Class {cls}</option>
                    {/each}
                </select>
                
                <select 
                    bind:value={filterTeacher}
                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-primary-500 transition-all"
                >
                    <option value="">All Teachers</option>
                    {#each uniqueTeachers as teacher}
                        <option value={teacher}>{teacher}</option>
                    {/each}
                </select>
                
                <input 
                    type="text"
                    bind:value={filterSubject}
                    placeholder="Search subject..."
                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-primary-500 transition-all flex-1 min-w-[200px]"
                />
                
                {#if filterClass || filterTeacher || filterSubject}
                    <button
                        on:click={() => {
                            filterClass = "";
                            filterTeacher = "";
                            filterSubject = "";
                        }}
                        class="px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg text-sm transition-all flex items-center gap-2"
                    >
                        <i class="fas fa-times"></i>
                        Clear
                    </button>
                {/if}
            </div>
        </div>

        <!-- Calendar -->
        {#if loading}
            <div class="flex justify-center py-20">
                <div class="text-center">
                    <i class="fas fa-spinner fa-spin text-5xl text-primary-500 mb-4"></i>
                    <p class="text-gray-600 dark:text-gray-400">Loading calendar...</p>
                </div>
            </div>
        {:else}
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <div bind:this={calendarEl} class="calendar-container p-4"></div>
            </div>
        {/if}

        <!-- Legend -->
        <div class="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 border border-blue-200 dark:border-gray-600">
            <div class="flex flex-wrap items-center gap-4">
                <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    <i class="fas fa-info-circle mr-2"></i>
                    Class Colors:
                </span>
                <div class="flex flex-wrap gap-3">
                    {#each uniqueClasses as cls}
                        <div class="flex items-center gap-2">
                            <div class="w-4 h-4 rounded" style="background-color: {getClassColor(cls)}"></div>
                            <span class="text-sm text-gray-700 dark:text-gray-300">Class {cls}</span>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    </div>
</Layout>

<!-- Schedule Detail Modal -->
{#if showDetailModal && selectedScheduleDetail}
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
        on:click={() => (showDetailModal = false)}
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl transform transition-all"
            on:click|stopPropagation
        >
            <div class="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-gray-700 dark:to-gray-800">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            {selectedScheduleDetail.subject}
                        </h3>
                        <div class="flex flex-wrap gap-2 text-sm">
                            <span class="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full font-medium">
                                <i class="fas fa-users mr-1"></i>
                                Class {selectedScheduleDetail.class}
                            </span>
                            <span class="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full font-medium">
                                <i class="fas fa-calendar mr-1"></i>
                                {selectedScheduleDetail.day}
                            </span>
                            <span class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                                <i class="fas fa-clock mr-1"></i>
                                {selectedScheduleDetail.startTime} - {selectedScheduleDetail.endTime}
                            </span>
                        </div>
                    </div>
                    <button
                        on:click={() => (showDetailModal = false)}
                        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>
            </div>

            <div class="p-6 space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <p class="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Teacher</p>
                        <p class="text-lg font-semibold text-gray-900 dark:text-white">
                            <i class="fas fa-chalkboard-teacher mr-2 text-primary-600"></i>
                            {selectedScheduleDetail.teacherName}
                        </p>
                    </div>
                    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <p class="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Room</p>
                        <p class="text-lg font-semibold text-gray-900 dark:text-white">
                            <i class="fas fa-door-open mr-2 text-primary-600"></i>
                            {selectedScheduleDetail.room}
                        </p>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        on:click={() => openAttendanceModal(selectedScheduleDetail)}
                        class="flex flex-col items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl transition-all border-2 border-blue-200 dark:border-blue-700"
                    >
                        <i class="fas fa-clipboard-list text-2xl text-blue-600 dark:text-blue-400"></i>
                        <span class="text-sm font-medium text-blue-700 dark:text-blue-300">Attendance</span>
                    </button>
                    <button
                        on:click={() => viewScheduleQR(selectedScheduleDetail)}
                        class="flex flex-col items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-xl transition-all border-2 border-green-200 dark:border-green-700"
                    >
                        <i class="fas fa-qrcode text-2xl text-green-600 dark:text-green-400"></i>
                        <span class="text-sm font-medium text-green-700 dark:text-green-300">QR Code</span>
                    </button>
                    <button
                        on:click={() => openModal(selectedScheduleDetail)}
                        class="flex flex-col items-center gap-2 p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-xl transition-all border-2 border-purple-200 dark:border-purple-700"
                    >
                        <i class="fas fa-edit text-2xl text-purple-600 dark:text-purple-400"></i>
                        <span class="text-sm font-medium text-purple-700 dark:text-purple-300">Edit</span>
                    </button>
                </div>

                <button
                    on:click={() => confirmDeleteSchedule(selectedScheduleDetail.id)}
                    class="w-full px-4 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl transition-all border-2 border-red-200 dark:border-red-700 flex items-center justify-center gap-2 font-medium"
                >
                    <i class="fas fa-trash"></i>
                    Delete Schedule
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Schedule Form Modal (same as original) -->
{#if showModal}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6"
        >
            <h3 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                {editingId ? "Edit" : "Add"} Schedule
            </h3>

            <form on:submit|preventDefault={handleSubmit} class="space-y-6">
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
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500"
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
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                                >Day</label
                            >
                            <select
                                bind:value={form.day}
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500"
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
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500"
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
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500"
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
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500"
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
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>
                </div>

                <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h4
                        class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 uppercase"
                    >
                        <i class="fas fa-users mr-2"></i>
                        Assign Students ({assignedStudentIds.length} selected)
                    </h4>

                    {#if allStudents.length === 0}
                        <div
                            class="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
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
                                class="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                        </div>
                        <div
                            class="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg"
                        >
                            <div class="divide-y divide-gray-200 dark:divide-gray-700">
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
                    class="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700"
                >
                    <button
                        type="button"
                        on:click={() => (showModal = false)}
                        disabled={submitting}
                        class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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

<!-- Manual Attendance Modal (same as original) -->
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
                        <p class="font-medium">No students enrolled</p>
                    </div>
                {:else}
                    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                        <table class="min-w-full">
                            <thead class="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Student</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Class</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {#each enrolledStudents as student}
                                <tr>
                                    <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{student.user.name}</td>
                                    <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-300">{student.class}</td>
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
                    disabled={savingAttendance || Object.keys(attendanceStatuses).length === 0}
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

<!-- QR Code Modal (same as original) -->
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

<style>
    :global(.calendar-container .ec) {
        --ec-bg-color: rgb(255 255 255);
        --ec-border-color: rgb(229 231 235);
        --ec-button-bg-color: transparent;
        --ec-button-text-color: rgb(75 85 99);
        --ec-button-active-bg-color: rgb(59 130 246);
        --ec-button-active-text-color: rgb(255 255 255);
        --ec-today-bg-color: rgb(219 234 254);
    }

    :global(.dark .calendar-container .ec) {
        --ec-bg-color: rgb(31 41 55);
        --ec-border-color: rgb(75 85 99);
        --ec-text-color: rgb(243 244 246);
        --ec-button-text-color: rgb(209 213 219);
        --ec-today-bg-color: rgb(30 58 138);
    }

    :global(.ec-event) {
        cursor: pointer;
        transition: all 0.2s;
    }

    :global(.ec-event:hover) {
        opacity: 0.9;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
</style>
