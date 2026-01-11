<script>
    import Layout from "../../components/Layout.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { toastStore } from "../../stores/toast.js";
    import { onMount } from "svelte";
    import * as XLSX from "xlsx";

    let students = [];
    let payments = [];
    let loading = false;

    // Get current date
    const now = new Date();
    const months = [
        { value: 'Januari', label: 'Januari' },
        { value: 'Februari', label: 'Februari' },
        { value: 'Maret', label: 'Maret' },
        { value: 'April', label: 'April' },
        { value: 'Mei', label: 'Mei' },
        { value: 'Juni', label: 'Juni' },
        { value: 'Juli', label: 'Juli' },
        { value: 'Agustus', label: 'Agustus' },
        { value: 'September', label: 'September' },
        { value: 'Oktober', label: 'Oktober' },
        { value: 'November', label: 'November' },
        { value: 'Desember', label: 'Desember' }
    ];

    // Filters
    let selectedMonth = now.toLocaleString('id-ID', { month: 'long' });
    let selectedYear = now.getFullYear();
    let searchQuery = "";
    let filterClass = "";

    // Pagination
    let currentPage = 1;
    let itemsPerPage = 10;

    onMount(() => {
        fetchData();
    });

    async function fetchData() {
        loading = true;
        try {
            const [studentsRes, paymentsRes] = await Promise.all([
                fetch(`${API_URL}/students`, {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                }),
                fetch(`${API_URL}/payments?limit=1000&status=APPROVED`, {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                }),
            ]);

            if (studentsRes.ok) {
                students = await studentsRes.json();
                console.log("Students loaded:", students.length);
                if (students.length > 0) {
                    console.log("First student sample:", students[0]);
                    console.log("Student structure:", {
                        id: students[0].id,
                        userId: students[0].userId,
                        class: students[0].class,
                        user: students[0].user
                    });
                }
            } else {
                console.error("Failed to fetch students:", studentsRes.status);
                toastStore.error("Gagal memuat data siswa. Backend mungkin tidak terkoneksi.");
            }
            
            if (paymentsRes.ok) {
                const apiResponse = await paymentsRes.json();
                console.log("RAW API Response:", apiResponse);
                
                // API returns {data: [...], pagination: {...}}
                payments = apiResponse.data || apiResponse.payments || (Array.isArray(apiResponse) ? apiResponse : []);
                console.log("Payments loaded:", payments.length);
                
                if (payments.length > 0) {
                    console.log("First payment sample:", payments[0]);
                    console.log("Payment structure:", {
                        id: payments[0].id,
                        studentId: payments[0].studentId,
                        student: payments[0].student,
                        status: payments[0].status,
                        month: payments[0].month,
                        year: payments[0].year
                    });
                    const withMonthYear = payments.filter(p => p.month && p.year).length;
                    const withoutMonthYear = payments.length - withMonthYear;
                    console.log(`Payments: ${withMonthYear} with month/year, ${withoutMonthYear} without (will use paymentDate)`);
                }
            } else {
                console.error("Failed to fetch payments:", paymentsRes.status);
                payments = [];
            }
        } catch (error) {
            console.error("Error:", error);
            toastStore.error("Error koneksi: " + error.message);
        } finally {
            loading = false;
        }
    }

    // Filter unpaid students
    $: unpaidStudents = (() => {
        // Safety check
        if (!Array.isArray(payments)) {
            console.error("Payments is not an array:", payments);
            return students;
        }

        console.log(`Filtering with: ${selectedMonth} ${selectedYear}`);
        console.log(`Total students: ${students.length}, Total payments: ${payments.length}`);
        
        // Debug: Check all payments
        const approvedPayments = payments.filter(p => p.status === 'APPROVED');
        console.log(`Approved payments: ${approvedPayments.length}`, approvedPayments);

        const paidStudentIds = new Set();
        
        const filtered = students.filter(student => {
            // Check if student has approved payment for selected month/year
            const hasPaid = payments.some(p => {
                if (!p) return false;
                
                // Payment might have studentId at root or nested in student.id
                const paymentStudentId = p.studentId || p.student?.id;
                
                if (!paymentStudentId) return false;
                
                const matchStudent = paymentStudentId === student.id;
                const isApproved = p.status === 'APPROVED';
                
                if (!matchStudent || !isApproved) return false;
                
                // Debug first match
                if (matchStudent && isApproved) {
                    console.log(`Student ${student.user?.name} has payment:`, {
                        paymentId: p.id,
                        month: p.month,
                        year: p.year,
                        paymentDate: p.paymentDate,
                        status: p.status
                    });
                }
                
                // If payment has month/year, use it
                if (p.month && p.year) {
                    // Check if selectedMonth exists in comma-separated month string
                    const monthsList = p.month.split(',').map(m => m.trim());
                    const matchMonth = monthsList.includes(selectedMonth);
                    const matchYear = p.year?.toString() === selectedYear.toString();
                    if (matchMonth && matchYear) {
                        paidStudentIds.add(student.id);
                        return true;
                    }
                }
                
                // If payment doesn't have month/year, use paymentDate
                if (p.paymentDate) {
                    const paymentDate = new Date(p.paymentDate);
                    const paymentMonth = paymentDate.toLocaleString('id-ID', { month: 'long' });
                    const paymentYear = paymentDate.getFullYear();
                    
                    console.log(`Payment date parsing: ${p.paymentDate} -> ${paymentMonth} ${paymentYear}`);
                    
                    const matchMonth = paymentMonth === selectedMonth;
                    const matchYear = paymentYear.toString() === selectedYear.toString();
                    
                    if (matchMonth && matchYear) {
                        paidStudentIds.add(student.id);
                        return true;
                    }
                }
                
                return false;
            });

            // Apply search filter
            const matchesSearch = !searchQuery || 
                student.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                student.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());

            // Apply class filter
            const matchesClass = !filterClass || student.class === filterClass;

            return !hasPaid && matchesSearch && matchesClass;
        });

        console.log(`Students who paid (${paidStudentIds.size}):`, Array.from(paidStudentIds));
        console.log(`Unpaid students after filter: ${filtered.length}`);
        return filtered;
    })();

    // Debug log
    $: console.log(`Filter: ${selectedMonth} ${selectedYear}, Total students: ${students.length}, Unpaid: ${unpaidStudents.length}, Payments with month/year:`, payments.filter(p => p.month && p.year).length);

    // Pagination
    $: totalPages = Math.ceil(unpaidStudents.length / itemsPerPage);
    $: paginatedStudents = unpaidStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    
    // Reset to page 1 when filters change
    $: if (selectedMonth || selectedYear || searchQuery || filterClass) {
        currentPage = 1;
    }

    function goToPage(page) {
        if (page >= 1 && page <= totalPages) {
            currentPage = page;
        }
    }

    // Get unique classes
    $: classes = [...new Set(students.map(s => s.class))].sort((a, b) => {
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
    });

    function exportToExcel() {
        const data = unpaidStudents.map((student, index) => ({
            No: index + 1,
            Nama: student.user?.name || '-',
            Email: student.user?.email || '-',
            Kelas: student.class || '-',
            Periode: `${selectedMonth} ${selectedYear}`,
            Status: 'Belum Lunas'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Belum Lunas");
        XLSX.writeFile(wb, `Belum-Lunas-${selectedMonth}-${selectedYear}.xlsx`);
        toastStore.success("Data berhasil diekspor!");
    }
</script>

<Layout activePage="/payments" title="Belum Lunas">
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                    <i class="fas fa-exclamation-circle mr-2 text-red-600"></i>
                    Siswa Belum Lunas
                </h2>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Daftar siswa yang belum melakukan pembayaran
                </p>
            </div>
            <button
                on:click={exportToExcel}
                disabled={unpaidStudents.length === 0}
                class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <i class="fas fa-file-excel"></i>
                <span>Ekspor Excel</span>
            </button>
        </div>

        <!-- Stats Card -->
        <div class="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-red-100 text-sm font-medium">Total Belum Lunas</p>
                    <p class="text-4xl font-bold mt-2">{unpaidStudents.length}</p>
                    <p class="text-red-100 text-sm mt-1">dari {students.length} siswa</p>
                </div>
                <div class="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <i class="fas fa-user-times text-3xl"></i>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <!-- Month Filter -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <i class="fas fa-calendar-alt mr-1"></i>
                        Bulan
                    </label>
                    <select
                        bind:value={selectedMonth}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        {#each months as month}
                            <option value={month.value}>{month.label}</option>
                        {/each}
                    </select>
                </div>

                <!-- Year Filter with Arrow Navigation -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <i class="fas fa-calendar mr-1"></i>
                        Tahun
                    </label>
                    <div class="flex items-center justify-center gap-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                        <button
                            type="button"
                            on:click={() => selectedYear--}
                            class="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <span class="text-lg font-bold text-gray-900 dark:text-white min-w-[70px] text-center">
                            {selectedYear}
                        </span>
                        <button
                            type="button"
                            on:click={() => selectedYear++}
                            class="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>

                <!-- Search -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <i class="fas fa-search mr-1"></i>
                        Cari Siswa
                    </label>
                    <input
                        type="text"
                        bind:value={searchQuery}
                        placeholder="Nama atau email..."
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                </div>

                <!-- Class Filter -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <i class="fas fa-users mr-1"></i>
                        Kelas
                    </label>
                    <select
                        bind:value={filterClass}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="">Semua Kelas</option>
                        {#each classes as cls}
                            <option value={cls}>Kelas {cls}</option>
                        {/each}
                    </select>
                </div>
            </div>
        </div>

        <!-- Table -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-x-auto border border-gray-200 dark:border-gray-700">
            {#if loading}
                <div class="flex justify-center py-20">
                    <i class="fas fa-spinner fa-spin text-4xl text-primary-500"></i>
                </div>
            {:else if unpaidStudents.length === 0}
                <div class="text-center py-20 text-gray-500 dark:text-gray-400">
                    <i class="fas fa-check-circle text-6xl mb-4 text-green-500"></i>
                    <p class="text-xl font-semibold mb-2">Semua Siswa Sudah Lunas!</p>
                    <p class="text-sm">Tidak ada siswa yang belum bayar untuk {selectedMonth} {selectedYear}</p>
                </div>
            {:else}
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                No
                            </th>
                            <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Nama Siswa
                            </th>
                            <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Email
                            </th>
                            <th class="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Kelas
                            </th>
                            <th class="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Periode
                            </th>
                            <th class="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {#each paginatedStudents as student, index}
                            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {(currentPage - 1) * itemsPerPage + index + 1}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="flex items-center">
                                        <div class="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center text-white font-bold mr-3">
                                            {student.user?.name?.charAt(0).toUpperCase() || 'S'}
                                        </div>
                                        <div class="text-sm font-medium text-gray-900 dark:text-white">
                                            {student.user?.name || '-'}
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {student.user?.email || '-'}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-center">
                                    <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                        Kelas {student.class}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-white font-medium">
                                    {selectedMonth} {selectedYear}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-center">
                                    <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                                        <i class="fas fa-times-circle mr-1"></i>
                                        Belum Lunas
                                    </span>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>

                <!-- Pagination -->
                {#if totalPages > 1}
                    <div class="bg-gray-50 dark:bg-gray-700 px-4 md:px-6 py-4 border-t border-gray-200 dark:border-gray-600">
                        <!-- Info Text - Hide on mobile -->
                        <div class="hidden md:flex items-center justify-between mb-3">
                            <div class="text-sm text-gray-700 dark:text-gray-300">
                                Menampilkan <span class="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
                                - <span class="font-medium">{Math.min(currentPage * itemsPerPage, unpaidStudents.length)}</span>
                                dari <span class="font-medium">{unpaidStudents.length}</span> siswa
                            </div>
                        </div>

                        <!-- Pagination Controls -->
                        <div class="flex items-center justify-between md:justify-center gap-2">
                            <!-- Previous Button -->
                            <button
                                on:click={() => goToPage(currentPage - 1)}
                                disabled={currentPage === 1}
                                class="px-3 py-2 md:px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            
                            <!-- Page Numbers -->
                            <div class="flex gap-1 md:gap-2">
                                {#each Array(totalPages) as _, i}
                                    <!-- Desktop: Show more pages -->
                                    {#if i + 1 === 1 || i + 1 === totalPages || (i + 1 >= currentPage - 1 && i + 1 <= currentPage + 1)}
                                        <button
                                            on:click={() => goToPage(i + 1)}
                                            class="hidden md:flex px-3 py-2 md:px-4 border rounded-lg text-sm font-medium transition-colors {currentPage === i + 1 
                                                ? 'bg-primary-600 border-primary-600 text-white' 
                                                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'}"
                                        >
                                            {i + 1}
                                        </button>
                                    {:else if i + 1 === currentPage - 2 || i + 1 === currentPage + 2}
                                        <span class="hidden md:block px-2 py-1 text-gray-500">...</span>
                                    {/if}

                                    <!-- Mobile: Only show current page and adjacent pages -->
                                    {#if (i + 1 >= currentPage - 1 && i + 1 <= currentPage + 1)}
                                        <button
                                            on:click={() => goToPage(i + 1)}
                                            class="flex md:hidden px-3 py-2 border rounded-lg text-sm font-medium transition-colors {currentPage === i + 1 
                                                ? 'bg-primary-600 border-primary-600 text-white' 
                                                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'}"
                                        >
                                            {i + 1}
                                        </button>
                                    {/if}
                                {/each}
                            </div>

                            <!-- Next Button -->
                            <button
                                on:click={() => goToPage(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                class="px-3 py-2 md:px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>

                        <!-- Mobile Info Text - Show current page -->
                        <div class="md:hidden text-center text-xs text-gray-600 dark:text-gray-400 mt-3">
                            Halaman {currentPage} dari {totalPages}
                        </div>
                    </div>
                {/if}
            {/if}
        </div>
    </div>
</Layout>
