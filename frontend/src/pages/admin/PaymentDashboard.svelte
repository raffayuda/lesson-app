<script>
    import Layout from "../../components/Layout.svelte";
    import { push } from "svelte-spa-router";
    import { auth, API_URL } from "../../stores/auth.js";
    import { toastStore } from "../../stores/toast.js";
    import { onMount } from "svelte";

    let loading = true;
    let statsLunas = 0;
    let statsBelumLunas = 0;

    onMount(async () => {
        await fetchStats();
    });

    async function fetchStats() {
        loading = true;
        try {
            const [paymentsRes, studentsRes] = await Promise.all([
                fetch(`${API_URL}/payments?limit=1000&status=APPROVED`, {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                }),
                fetch(`${API_URL}/students`, {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                }),
            ]);

            if (paymentsRes.ok && studentsRes.ok) {
                const paymentsData = await paymentsRes.json();
                const students = await studentsRes.json();

                // API returns {data: [...], pagination: {...}}
                const payments = paymentsData.data || paymentsData.payments || [];
                console.log('Total approved payments:', payments.length);

                // Get current month and year
                const now = new Date();
                const currentMonth = now.toLocaleString('id-ID', { month: 'long' });
                const currentYear = now.getFullYear();

                console.log('Current filter:', currentMonth, currentYear);

                // Filter approved payments for current month
                const approvedPayments = payments.filter(p => {
                    // Use month/year if available, otherwise use paymentDate
                    if (p.month && p.year) {
                        // Check if currentMonth exists in comma-separated month string
                        const monthsList = p.month.split(',').map(m => m.trim());
                        return monthsList.includes(currentMonth) && p.year === currentYear;
                    }
                    if (p.paymentDate) {
                        const paymentDate = new Date(p.paymentDate);
                        const paymentMonth = paymentDate.toLocaleString('id-ID', { month: 'long' });
                        const paymentYear = paymentDate.getFullYear();
                        return paymentMonth === currentMonth && paymentYear === currentYear;
                    }
                    return false;
                });

                console.log('Payments for current month:', approvedPayments.length);

                // Get unique students who paid this month
                const paidStudentIds = new Set(
                    approvedPayments
                        .map(p => p.studentId || p.student?.id)
                        .filter(id => id != null)
                );
                
                statsLunas = paidStudentIds.size;
                statsBelumLunas = students.length - paidStudentIds.size;
            }
        } catch (error) {
            console.error("Error:", error);
            toastStore.error("Gagal memuat data: " + error.message);
        } finally {
            loading = false;
        }
    }

    function navigateToLunas() {
        push("/payments/lunas");
    }

    function navigateToBelumLunas() {
        push("/payments/belum-lunas");
    }
</script>

<Layout activePage="/payments" title="Pembayaran">
    <div class="space-y-6">
        <!-- Header -->
        <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                <i class="fas fa-wallet mr-2 text-primary-600"></i>
                Manajemen Pembayaran
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Pilih kategori pembayaran untuk dikelola
            </p>
        </div>

        {#if loading}
            <div class="flex justify-center py-20">
                <i class="fas fa-spinner fa-spin text-4xl text-primary-500"></i>
            </div>
        {:else}
            <!-- Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Card Lunas -->
                <button
                    on:click={navigateToLunas}
                    class="bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-2xl p-8 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 text-left"
                >
                    <div class="flex items-start justify-between">
                        <div>
                            <div class="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                                <i class="fas fa-check-circle text-3xl"></i>
                            </div>
                            <h3 class="text-2xl font-bold mb-2">Lunas</h3>
                            <p class="text-green-100 mb-4">Siswa yang sudah melakukan pembayaran</p>
                            <div class="text-5xl font-bold">{statsLunas}</div>
                            <p class="text-green-100 mt-2">Siswa</p>
                        </div>
                        <i class="fas fa-chevron-right text-2xl opacity-50"></i>
                    </div>
                </button>

                <!-- Card Belum Lunas -->
                <button
                    on:click={navigateToBelumLunas}
                    class="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-2xl p-8 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 text-left"
                >
                    <div class="flex items-start justify-between">
                        <div>
                            <div class="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                                <i class="fas fa-exclamation-circle text-3xl"></i>
                            </div>
                            <h3 class="text-2xl font-bold mb-2">Belum Lunas</h3>
                            <p class="text-red-100 mb-4">Siswa yang belum melakukan pembayaran</p>
                            <div class="text-5xl font-bold">{statsBelumLunas}</div>
                            <p class="text-red-100 mt-2">Siswa</p>
                        </div>
                        <i class="fas fa-chevron-right text-2xl opacity-50"></i>
                    </div>
                </button>
            </div>

            <!-- Info Box -->
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <div class="flex items-start gap-3">
                    <i class="fas fa-info-circle text-blue-600 dark:text-blue-400 mt-1"></i>
                    <div>
                        <h4 class="font-semibold text-blue-900 dark:text-blue-100 mb-2">Informasi</h4>
                        <ul class="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                            <li>• <strong>Lunas:</strong> Kelola pembayaran yang sudah disetujui dan diterima</li>
                            <li>• <strong>Belum Lunas:</strong> Monitor siswa yang belum melakukan pembayaran per periode</li>
                            <li>• Data yang ditampilkan adalah untuk bulan berjalan</li>
                        </ul>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</Layout>
