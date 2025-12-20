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
    let showDetailModal = false;
    let editingId = null;
    let submitting = false;
    let processing = false;
    let processingMessage = "Processing...";
    let errorMessage = ""; // For inline error display
    
    let selectedScheduleQR = null;
    let selectedScheduleAttendance = null;
    let selectedScheduleDetail = null;
    let qrDataUrl = "";
    let assignedStudentIds = [];
    let searchQuery = "";
    let enrolledStudents = [];
    let attendanceStatuses = {};
    let savingAttendance = false;
    let currentAttendanceDate = null; // Track which date's attendance we're viewing
    
    // View mode and calendar state
    let currentView = 'calendar'; // 'calendar' or 'list'
    let currentWeekStart = new Date();
    let currentMonth = new Date();
    
    // Quick add state
    let showQuickAddModal = false;
    let quickAddDay = "";
    let quickAddTime = "";
    let quickAddDate = null;
    let scheduleRecurring = true; // true = every week, false = specific date only
    
    // Filters
    let filterTeacher = "";
    let filterSubject = "";
    let weekLabel = "";
    
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
        day: "Senin",
        startTime: "",
        endTime: "",
        teacherName: "",
        room: "",
        specificDate: null, // For one-time schedules
    };

    const days = [
        "Senin",
        "Selasa",
        "Rabu",
        "Kamis",
        "Jumat",
        "Sabtu",
    ];
    
    const dayMapping = {
        'Senin': 1,
        'Selasa': 2,
        'Rabu': 3,
        'Kamis': 4,
        'Jumat': 5,
        'Sabtu': 6,
        'Minggu': 0
    };
    
    const timeSlots = [
        "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
        "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
    ];

    onMount(() => {
        fetchSchedules();
        fetchAllStudents();
        setCurrentWeek();
    });
    
    function setCurrentWeek() {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Start from Monday
        currentWeekStart = new Date(now);
        currentWeekStart.setDate(now.getDate() + diff);
        currentWeekStart.setHours(0, 0, 0, 0);
    }
    
    function getWeekDays() {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + i);
            days.push(date);
        }
        return days;
    }
    
    function getDayName(date) {
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return dayNames[date.getDay()];
    }
    
    function isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }
    
    function getSchedulesForDay(dayName) {
        return filteredSchedules.filter(s => s.day === dayName);
    }
    
    function getSchedulesForDayAndTime(dayName, timeSlot, currentDate = null) {
        const result = filteredSchedules.filter(s => {
            // If schedule has specificDate (one-time), check the date only
            if (s.specificDate) {
                if (!currentDate) return false;
                
                const scheduleDate = new Date(s.specificDate);
                const compareDate = new Date(currentDate);
                
                // Compare year, month, and day only
                const isSameDate = scheduleDate.getFullYear() === compareDate.getFullYear() &&
                                  scheduleDate.getMonth() === compareDate.getMonth() &&
                                  scheduleDate.getDate() === compareDate.getDate();
                
                if (!isSameDate) return false;
                // Don't check day name for specific date schedules
            } else {
                // For recurring schedules, check the day name
                if (s.day !== dayName) return false;
            }
            
            // Handle both HH:MM and HH:MM:SS format
            const scheduleStart = s.startTime.includes(':') ? s.startTime.split(':').slice(0, 2).join(':') : s.startTime;
            const [startHour] = scheduleStart.split(':').map(Number);
            const [slotHour] = timeSlot.split(':').map(Number);
            
            // Check if schedule starts within this hour slot
            return startHour === slotHour;
        });
        
        return result;
    }
    
    function nextWeek() {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + 7);
        currentWeekStart = newDate;
    }
    
    function prevWeek() {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() - 7);
        currentWeekStart = newDate;
    }
    
    function goToToday() {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const newDate = new Date(now);
        newDate.setDate(now.getDate() + diff);
        newDate.setHours(0, 0, 0, 0);
        currentWeekStart = newDate;
    }
    
    function getDayColor(dayName) {
        const colors = {
            'Senin': '#ef4444',    // Red
            'Selasa': '#f59e0b',   // Orange
            'Rabu': '#10b981',     // Green
            'Kamis': '#3b82f6',    // Blue
            'Jumat': '#8b5cf6',    // Purple
            'Sabtu': '#ec4899',    // Pink
            'Minggu': '#6366f1',   // Indigo
        };
        return colors[dayName] || '#6366f1';
    }

    async function fetchSchedules() {
        loading = true;
        try {
            const response = await fetch(`${API_URL}/schedules`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });
            if (response.ok) {
                schedules = await response.json();
                console.log('Fetched schedules:', schedules.length, 'schedules');
                if (schedules.length > 0) {
                    console.log('Sample schedule:', schedules[0]);
                }
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
    
    function openScheduleDetail(schedule, viewDate = null) {
        selectedScheduleDetail = schedule;
        selectedScheduleDetail.viewDate = viewDate; // Store the date context
        showDetailModal = true;
    }
    
    function openQuickAdd(day, date, timeSlot) {
        quickAddDay = getDayName(date);
        quickAddDate = date;
        quickAddTime = timeSlot;
        
        // Pre-fill form
        form.day = quickAddDay;
        form.startTime = timeSlot;
        // Set end time 1 hour later
        const [hour, minute] = timeSlot.split(':').map(Number);
        const endHour = (hour + 1).toString().padStart(2, '0');
        form.endTime = `${endHour}:${minute.toString().padStart(2, '0')}`;
        
        showQuickAddModal = true;
        scheduleRecurring = true; // Default to recurring
    }
    
    function proceedToFullForm() {
        showQuickAddModal = false;
        showModal = true;
        editingId = null;
        assignedStudentIds = [];
        searchQuery = "";
        
        // If one-time schedule, store the specific date
        if (!scheduleRecurring && quickAddDate) {
            // Set time to noon UTC to prevent timezone issues
            const dateForSchedule = new Date(quickAddDate);
            dateForSchedule.setHours(12, 0, 0, 0); // Set to noon to avoid timezone shifting
            form.specificDate = dateForSchedule.toISOString();
        } else {
            form.specificDate = null;
        }
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
                specificDate: null,
            };
            assignedStudentIds = [];
        }
        searchQuery = "";
        errorMessage = "";
        showModal = true;
    }

    async function handleSubmit() {
        submitting = true;
        errorMessage = ""; // Clear previous errors
        try {
            const url = editingId
                ? `${API_URL}/schedules/${editingId}`
                : `${API_URL}/schedules`;
            const method = editingId ? "PUT" : "POST";

            const payload = {
                ...form,
                class: form.subject, // Use subject as class for internal purposes
                studentIds: assignedStudentIds,
            };
            
            console.log('Submitting schedule:', payload);

            const response = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${auth.getToken()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                showModal = false;
                await fetchSchedules();
                toastStore.success(
                    editingId
                        ? "Jadwal berhasil diperbarui!"
                        : "Jadwal berhasil ditambahkan!"
                );
            } else {
                const data = await response.json();
                errorMessage = data.error || "Gagal menyimpan jadwal";
            }
        } catch (error) {
            errorMessage = "Error: " + error.message;
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

    async function openAttendanceModal(schedule, attendanceDate = null) {
        selectedScheduleAttendance = schedule;
        attendanceStatuses = {}; // Reset to empty
        showDetailModal = false;
        
        // Determine which date to use for attendance
        let dateToUse;
        if (attendanceDate) {
            // Use the date passed from calendar (already a Date object)
            const localDate = new Date(attendanceDate);
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            dateToUse = `${year}-${month}-${day}`;
        } else if (schedule.specificDate) {
            // For one-time schedules, use the specific date
            const localDate = new Date(schedule.specificDate);
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            dateToUse = `${year}-${month}-${day}`;
        } else {
            // For recurring schedules without context, use today (local time)
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            dateToUse = `${year}-${month}-${day}`;
        }
        
        currentAttendanceDate = dateToUse;
        console.log('Opening attendance for date:', dateToUse, 'schedule:', schedule.subject);

        try {
            const response = await fetch(
                `${API_URL}/schedules/${schedule.id}/students`,
                {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                },
            );

            if (response.ok) {
                enrolledStudents = await response.json();
                console.log('Enrolled students:', enrolledStudents);

                const attResponse = await fetch(
                    `${API_URL}/attendance?scheduleId=${schedule.id}&date=${dateToUse}`,
                    {
                        headers: { Authorization: `Bearer ${auth.getToken()}` },
                    },
                );

                if (attResponse.ok) {
                    const existingAtt = await attResponse.json();
                    console.log('Fetched attendance:', existingAtt);
                    console.log('Mapping attendance to students...');
                    existingAtt.forEach((att) => {
                        console.log(`  Student ID: ${att.studentId}, Status: ${att.status}`);
                        attendanceStatuses[att.studentId] = att.status;
                    });
                    console.log('Final attendanceStatuses:', attendanceStatuses);
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
                            date: currentAttendanceDate, // Send the date we're viewing
                        }),
                    });
                },
            );

            await Promise.all(promises);
            toastStore.success("Attendance saved successfully!");
            
            // Reload attendance data for this date before closing
            await openAttendanceModal(selectedScheduleAttendance, currentAttendanceDate);
            
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
    
    $: uniqueTeachers = [...new Set(schedules.map(s => s.teacherName))].sort();
    
    $: filteredSchedules = schedules.filter(schedule => {
        if (filterTeacher && schedule.teacherName !== filterTeacher) return false;
        if (filterSubject && !schedule.subject.toLowerCase().includes(filterSubject.toLowerCase())) return false;
        return true;
    });
    
    // Force weekDays to recalculate when currentWeekStart changes
    $: weekDays = currentWeekStart ? getWeekDays() : [];
    
    $: {
        if (currentWeekStart) {
            const endDate = new Date(currentWeekStart);
            endDate.setDate(currentWeekStart.getDate() + 6);
            weekLabel = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
    }
</script>

<Layout activePage="/schedules" title="Schedules Management">
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h2 class="text-3xl font-bold text-gray-900 dark:text-white">
                    <i class="fas fa-calendar-alt mr-2 text-primary-600"></i>
                    Kalender Jadwal
                </h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Kelola jadwal mingguan dengan tampilan kalender interaktif
                </p>
            </div>
            <div class="flex items-center gap-3">
                <!-- View Toggle -->
                <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                        on:click={() => currentView = 'calendar'}
                        class="px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 {currentView === 'calendar' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}"
                    >
                        <i class="fas fa-calendar"></i>
                        <span class="hidden sm:inline">Kalender</span>
                    </button>
                    <button
                        on:click={() => currentView = 'list'}
                        class="px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 {currentView === 'list' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}"
                    >
                        <i class="fas fa-list"></i>
                        <span class="hidden sm:inline">Daftar</span>
                    </button>
                </div>
                
            </div>
        </div>

        <!-- Filters -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border border-gray-200 dark:border-gray-700">
            <div class="flex flex-wrap items-center gap-3">
                <div class="flex items-center gap-2">
                    <i class="fas fa-filter text-gray-500 dark:text-gray-400"></i>
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
                </div>
                
                <select 
                    bind:value={filterTeacher}
                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-primary-500 transition-all"
                >
                    <option value="">Semua Pengajar</option>
                    {#each uniqueTeachers as teacher}
                        <option value={teacher}>{teacher}</option>
                    {/each}
                </select>
                
                <input 
                    type="text"
                    bind:value={filterSubject}
                    placeholder="Cari mata pelajaran..."
                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-primary-500 transition-all flex-1 min-w-[200px]"
                />
                
                {#if filterTeacher || filterSubject}
                    <button
                        on:click={() => {
                            filterTeacher = "";
                            filterSubject = "";
                        }}
                        class="px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg text-sm transition-all flex items-center gap-2"
                    >
                        <i class="fas fa-times"></i>
                        Hapus
                    </button>
                {/if}
                
                <div class="ml-auto text-xs text-gray-500 dark:text-gray-400">
                    <span class="font-medium">{filteredSchedules.length}</span> jadwal
                </div>
            </div>
        </div>

        {#if currentView === 'calendar'}
            <!-- Calendar View -->
            {#if loading}
                <div class="flex justify-center py-20">
                    <div class="text-center">
                        <i class="fas fa-spinner fa-spin text-5xl text-primary-500 mb-4"></i>
                        <p class="text-gray-600 dark:text-gray-400">Loading calendar...</p>
                    </div>
                </div>
            {:else}
                <!-- Calendar Header -->
                <div class="bg-white dark:bg-gray-800 rounded-t-xl shadow-lg p-3 sm:p-4 border border-b-0 border-gray-200 dark:border-gray-700">
                    <div class="flex items-center justify-between gap-2 sm:gap-4">
                        <!-- Navigation Buttons -->
                        <div class="flex items-center gap-1 sm:gap-2">
                            <button
                                on:click={prevWeek}
                                class="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all text-sm sm:text-base"
                                aria-label="Previous week"
                            >
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <button
                                on:click={goToToday}
                                class="px-2 sm:px-4 py-2 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50 rounded-lg font-medium transition-all text-xs sm:text-sm whitespace-nowrap"
                            >
                                Hari Ini
                            </button>
                            <button
                                on:click={nextWeek}
                                class="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all text-sm sm:text-base"
                                aria-label="Next week"
                            >
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                        
                        <!-- Week Label -->
                        <h3 class="text-sm sm:text-base lg:text-lg font-bold text-gray-900 dark:text-white text-center flex-1 min-w-0">
                            <span class="hidden sm:inline">{weekLabel}</span>
                            <span class="sm:hidden">{weekLabel.split(' - ')[0].split(', ')[1]}</span>
                        </h3>
                    </div>
                </div>

            <!-- Calendar Grid -->
            <div class="bg-white dark:bg-gray-800 rounded-b-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <div class="overflow-x-auto">
                    <div class="min-w-[900px]">
                        <!-- Day Headers -->
                        <div class="grid grid-cols-8 border-b-2 border-gray-300 dark:border-gray-600">
                            <div class="p-3 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600">
                                <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">TIME</span>
                            </div>
                            {#each weekDays as day}
                                <div class="p-3 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 last:border-r-0">
                                    <div class="text-center">
                                        <p class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                                            {getDayName(day).substring(0, 3)}
                                        </p>
                                        <p class="text-lg font-bold mt-1 {isToday(day) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white'}">
                                            {day.getDate()}
                                        </p>
                                        {#if isToday(day)}
                                            <div class="w-2 h-2 bg-primary-600 rounded-full mx-auto mt-1"></div>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>

                        <!-- Time Slots -->
                        {#each timeSlots as timeSlot}
                            <div class="grid grid-cols-8 border-b border-gray-200 dark:border-gray-600">
                                <div class="p-3 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 flex items-start">
                                    <span class="text-xs font-medium text-gray-600 dark:text-gray-400">{timeSlot}</span>
                                </div>
                                {#each weekDays as day}
                                    {@const daySchedules = getSchedulesForDayAndTime(getDayName(day), timeSlot, day)}
                                    <div class="p-2 border-r border-gray-200 dark:border-gray-600 last:border-r-0 min-h-[80px] transition-colors relative group">
                                        {#if daySchedules.length > 0}
                                            {#each daySchedules as schedule}
                                                <button
                                                    on:click={() => openScheduleDetail(schedule, day)}
                                                    class="w-full text-left p-2 rounded-lg mb-2 hover:scale-105 transition-transform duration-200 shadow-sm hover:shadow-md"
                                                    style="background-color: {getDayColor(schedule.day)}; color: white;"
                                                >
                                                    <p class="text-xs font-bold truncate">{schedule.subject}</p>
                                                    <p class="text-xs opacity-75 truncate">
                                                        <i class="fas fa-clock mr-1"></i>
                                                        {schedule.startTime.substring(0, 5)} - {schedule.endTime.substring(0, 5)}
                                                    </p>
                                                    <p class="text-xs opacity-75 truncate">
                                                        <i class="fas fa-door-open mr-1"></i>
                                                        {schedule.room}
                                                    </p>
                                                    {#if schedule.specificDate}
                                                        <p class="text-xs opacity-75 truncate mt-1">
                                                            <i class="fas fa-calendar-day mr-1"></i>
                                                            Sekali
                                                        </p>
                                                    {/if}
                                                </button>
                                            {/each}
                                        {:else}
                                            <!-- Empty slot with hover add button -->
                                            <button
                                                on:click={() => openQuickAdd(getDayName(day), day, timeSlot)}
                                                class="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg"
                                            >
                                                <div class="text-center">
                                                    <i class="fas fa-plus-circle text-2xl text-primary-500 dark:text-primary-400 mb-1"></i>
                                                    <p class="text-xs text-primary-600 dark:text-primary-300 font-medium">Tambah Jadwal</p>
                                                </div>
                                            </button>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
            {/if}
        {:else}
            <!-- List View -->
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {#if loading}
                    <div class="flex justify-center py-20">
                        <div class="text-center">
                            <i class="fas fa-spinner fa-spin text-5xl text-primary-500 mb-4"></i>
                            <p class="text-gray-600 dark:text-gray-400">Memuat jadwal...</p>
                        </div>
                    </div>
                {:else if filteredSchedules.length === 0}
                    <div class="text-center py-20">
                        <i class="fas fa-calendar-times text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
                        <p class="text-gray-600 dark:text-gray-400">Tidak ada jadwal ditemukan</p>
                    </div>
                {:else}
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mata Pelajaran</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hari</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Waktu</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pengajar</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ruangan</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipe</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {#each filteredSchedules as schedule}
                                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer" on:click={() => openScheduleDetail(schedule)}>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="text-sm font-medium text-gray-900 dark:text-white">{schedule.subject}</div>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="text-sm text-gray-900 dark:text-white">
                                                {#if schedule.specificDate}
                                                    {new Date(schedule.specificDate).toLocaleDateString('id-ID', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                {:else}
                                                    {schedule.day}
                                                {/if}
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="text-sm text-gray-900 dark:text-white">
                                                <i class="fas fa-clock mr-1 text-gray-400"></i>
                                                {schedule.startTime.substring(0, 5)} - {schedule.endTime.substring(0, 5)}
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="text-sm text-gray-900 dark:text-white">{schedule.teacherName}</div>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="text-sm text-gray-900 dark:text-white">
                                                <i class="fas fa-door-open mr-1 text-gray-400"></i>
                                                {schedule.room}
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            {#if schedule.specificDate}
                                                <span class="inline-flex px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                                                    <i class="fas fa-calendar-day mr-1"></i> Sekali
                                                </span>
                                            {:else}
                                                <span class="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                                                    <i class="fas fa-repeat mr-1"></i> Berulang
                                                </span>
                                            {/if}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                on:click|stopPropagation={() => openScheduleDetail(schedule)}
                                                class="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 mr-3"
                                            >
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            <button
                                                on:click|stopPropagation={() => openModal(schedule)}
                                                class="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                                            >
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button
                                                on:click|stopPropagation={() => confirmDeleteSchedule(schedule.id)}
                                                class="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                                            >
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</Layout>

<!-- Quick Add Modal -->
{#if showQuickAddModal}
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
        on:click={() => (showQuickAddModal = false)}
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl transform transition-all"
            on:click|stopPropagation
        >
            <div class="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-gray-700 dark:to-gray-800">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            <i class="fas fa-calendar-plus mr-2 text-primary-600"></i>
                            Tambah Jadwal Baru
                        </h3>
                        <div class="flex flex-wrap gap-2 text-sm">
                            <span class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                                <i class="fas fa-calendar mr-1"></i>
                                {quickAddDay}
                            </span>
                            <span class="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full font-medium">
                                <i class="fas fa-clock mr-1"></i>
                                {quickAddTime}
                            </span>
                            {#if quickAddDate}
                                <span class="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-medium">
                                    <i class="fas fa-calendar-day mr-1"></i>
                                    {quickAddDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                            {/if}
                        </div>
                    </div>
                    <button
                        on:click={() => (showQuickAddModal = false)}
                        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
            </div>

            <div class="p-6 space-y-6">
                <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <p class="text-sm text-blue-700 dark:text-blue-300 font-medium mb-3">
                        <i class="fas fa-info-circle mr-2"></i>
                        Pilih tipe jadwal:
                    </p>
                    
                    <div class="space-y-3">
                        <label class="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border-2 cursor-pointer transition-all {scheduleRecurring ? 'border-primary-500 shadow-md' : 'border-gray-200 dark:border-gray-600 hover:border-primary-300'}">
                            <input
                                type="radio"
                                bind:group={scheduleRecurring}
                                value={true}
                                class="mt-1 w-5 h-5 text-primary-600"
                            />
                            <div class="flex-1">
                                <p class="font-semibold text-gray-900 dark:text-white">
                                    <i class="fas fa-repeat mr-2 text-primary-600"></i>
                                    Jadwal Berulang
                                </p>
                                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    Setiap {quickAddDay} pukul {quickAddTime}
                                </p>
                                <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                    (Untuk kelas rutin mingguan)
                                </p>
                            </div>
                        </label>
                        
                        <label class="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border-2 cursor-pointer transition-all {!scheduleRecurring ? 'border-primary-500 shadow-md' : 'border-gray-200 dark:border-gray-600 hover:border-primary-300'}">
                            <input
                                type="radio"
                                bind:group={scheduleRecurring}
                                value={false}
                                class="mt-1 w-5 h-5 text-primary-600"
                            />
                            <div class="flex-1">
                                <p class="font-semibold text-gray-900 dark:text-white">
                                    <i class="fas fa-calendar-day mr-2 text-green-600"></i>
                                    Jadwal Sekali
                                </p>
                                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    Hanya pada {quickAddDate?.toLocaleDateString('id-ID', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                </p>
                                <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                    (Untuk acara khusus atau pengganti)
                                </p>
                            </div>
                        </label>
                    </div>
                </div>

                <div class="flex gap-3">
                    <button
                        on:click={() => (showQuickAddModal = false)}
                        class="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium transition-all"
                    >
                        <i class="fas fa-times mr-2"></i>
                        Batal
                    </button>
                    <button
                        on:click={proceedToFullForm}
                        class="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                        <i class="fas fa-arrow-right"></i>
                        Lanjutkan
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

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
                        on:click={() => {
                            // For recurring schedules, always use today's date
                            // For one-time schedules, use the specific date or viewDate
                            const dateToUse = selectedScheduleDetail.specificDate 
                                ? selectedScheduleDetail.viewDate 
                                : null;
                            openAttendanceModal(selectedScheduleDetail, dateToUse);
                        }}
                        class="flex flex-col items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl transition-all border-2 border-blue-200 dark:border-blue-700"
                    >
                        <i class="fas fa-clipboard-list text-2xl text-blue-600 dark:text-blue-400"></i>
                        <span class="text-sm font-medium text-blue-700 dark:text-blue-300">Absensi</span>
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
                {editingId ? "Edit" : "Tambah"} Jadwal
            </h3>

            <form on:submit|preventDefault={handleSubmit} class="space-y-6">
                <!-- Error Message Display -->
                {#if errorMessage}
                    <div class="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-lg">
                        <div class="flex items-center gap-3">
                            <i class="fas fa-exclamation-circle text-red-500 text-xl"></i>
                            <div>
                                <p class="text-sm font-semibold text-red-800 dark:text-red-200">Error</p>
                                <p class="text-sm text-red-700 dark:text-red-300 mt-1">{errorMessage}</p>
                            </div>
                        </div>
                    </div>
                {/if}

                <div>
                    <h4
                        class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 uppercase"
                    >
                        Informasi Jadwal
                    </h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                                >Mata Pelajaran</label
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
                                >Hari</label
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
                                >Ruangan</label
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
                                >Waktu Mulai</label
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
                                >Waktu Selesai</label
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
                                >Nama Pengajar</label
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
                        Tetapkan Siswa ({assignedStudentIds.length} dipilih)
                    </h4>

                    {#if allStudents.length === 0}
                        <div
                            class="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                        >
                            <i class="fas fa-users-slash text-4xl mb-2"></i>
                            <p>
                                Tidak ada siswa. Silakan tambahkan siswa terlebih dahulu.
                            </p>
                        </div>
                    {:else}
                        <div class="mb-3">
                            <input
                                type="text"
                                bind:value={searchQuery}
                                placeholder="Cari siswa berdasarkan nama atau kelas..."
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
                                    <th class="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Student</th>
                                    <th class="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase hidden sm:table-cell">Class</th>
                                    <th class="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {#each enrolledStudents as student}
                                <tr>
                                    <td class="px-2 sm:px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{student.user.name}</td>
                                    <td class="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-300 hidden sm:table-cell">{student.class}</td>
                                    <td class="px-2 sm:px-4 py-3">
                                        <div class="flex gap-1 sm:gap-2">
                                            <button
                                                type="button"
                                                on:click={() => {
                                                    attendanceStatuses[student.id] = 'PRESENT';
                                                    attendanceStatuses = {...attendanceStatuses};
                                                }}
                                                class="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm font-semibold transition-all {attendanceStatuses[student.id] === 'PRESENT' ? 'bg-green-500 border-green-600 text-white' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-green-500'}"
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
                                                class="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm font-semibold transition-all {attendanceStatuses[student.id] === 'SICK' ? 'bg-yellow-500 border-yellow-600 text-white' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-yellow-500'}"
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
                                                class="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm font-semibold transition-all {attendanceStatuses[student.id] === 'PERMISSION' ? 'bg-blue-500 border-blue-600 text-white' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-500'}"
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
                                                class="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm font-semibold transition-all {attendanceStatuses[student.id] === 'ABSENT' ? 'bg-red-500 border-red-600 text-white' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-red-500'}"
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

            <div class="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <button
                    on:click={() => (showAttendanceModal = false)}
                    class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2"
                    disabled={savingAttendance}
                >
                    <i class="fas fa-times"></i>
                    <span>Cancel</span>
                </button>
                <button
                    on:click={saveAttendance}
                    class="px-6 py-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
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

