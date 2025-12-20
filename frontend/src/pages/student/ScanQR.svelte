<script>
    import Layout from "../../components/Layout.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { onMount, onDestroy } from "svelte";
    import { Html5Qrcode } from "html5-qrcode";

    let scanner;
    let scanning = false;
    let showScanModal = false;
    let isProcessing = false; // Prevent multiple scans
    let isSubmitting = false; // Loading state for server processing
    let error = "";
    let success = "";
    let recentAttendance = [];
    let dataFetched = false; // Cache flag

    onMount(async () => {
        await fetchRecentAttendance();
    });

    async function fetchRecentAttendance() {
        // Skip if already fetched (cache)
        if (dataFetched) {
            return;
        }

        try {
            // Get student ID from auth
            const student = $auth.user.student;
            if (!student) return;

            // Add limit parameter to reduce data transfer
            const response = await fetch(
                `${API_URL}/attendance?studentId=${student.id}&limit=5&sort=desc`,
                {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                },
            );

            if (response.ok) {
                const all = await response.json();
                recentAttendance = all.slice(0, 5); // Last 5 records
                dataFetched = true; // Mark as cached
            }
        } catch (err) {
            console.error("Error fetching attendance:", err);
        }
    }

    async function startScanning() {
        showScanModal = true;
        error = "";
        success = "";
        isProcessing = false; // Reset processing flag

        // Use requestAnimationFrame for better performance
        requestAnimationFrame(async () => {
            try {
                scanner = new Html5Qrcode("qr-reader");
                scanning = true;

                await scanner.start(
                    { facingMode: "environment" },
                    {
                        fps: 30, // Increased from 10 for faster scanning
                        qrbox: { width: 200, height: 200 }, // Smaller box = faster processing
                        aspectRatio: 1.0, // Square aspect ratio
                        disableFlip: false, // Enable flip for better detection
                    },
                    async (decodedText) => {
                        // Prevent multiple scans with debouncing
                        if (isProcessing) return;
                        isProcessing = true;

                        await handleScan(decodedText);
                        await stopScanning();
                    },
                    () => {}, // Error callback - silent failures
                );
            } catch (err) {
                error = "Failed to start camera: " + err.message;
                scanning = false;
                showScanModal = false;
                isProcessing = false;
            }
        });
    }

    async function stopScanning() {
        if (scanner && scanning) {
            try {
                await scanner.stop();
                await scanner.clear();
                scanner = null; // Release scanner instance
                scanning = false;
                showScanModal = false;
            } catch (err) {
                console.error("Error stopping scanner:", err);
            } finally {
                isProcessing = false; // Reset processing flag
            }
        }
    }

    async function handleScan(qrCode) {
        try {
            isSubmitting = true; // Show loading overlay

            const response = await fetch(`${API_URL}/attendance/qr`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${auth.getToken()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ qrCode }),
            });

            const data = await response.json();

            if (response.ok) {
                success = `Kehadiran berhasil dicatat untuk ${data.schedule.subject} - ${data.schedule.class}`;
                error = "";

                // Invalidate cache and refetch
                dataFetched = false;
                await fetchRecentAttendance();
            } else {
                error = data.error || "Gagal mencatat kehadiran";
                success = "";
            }
        } catch (err) {
            error = "Gagal mencatat kehadiran: " + err.message;
            success = "";
        } finally {
            isSubmitting = false; // Hide loading overlay
        }
    }

    function getStatusColor(status) {
        const colors = {
            PRESENT: "bg-green-100 text-green-800",
            SICK: "bg-yellow-100 text-yellow-800",
            PERMISSION: "bg-blue-100 text-blue-800",
            ABSENT: "bg-red-100 text-red-800",
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

    onDestroy(async () => {
        await stopScanning();
    });
</script>

<Layout activePage="/" title="Scan QR Code">
    <div class="max-w-2xl mx-auto space-y-6">
        <div
            class="bg-white rounded-lg shadow p-6 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        >
            <h2
                class="text-xl font-semibold text-gray-900 mb-4 dark:text-white"
            >
                <i class="fas fa-qrcode mr-2"></i>Pindai Kode QR Jadwal
            </h2>

            <div
                class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700"
            >
                <i class="fas fa-info-circle mr-2"></i>
                Pindai kode QR yang ditampilkan untuk jadwal Anda untuk mencatat kehadiran secara otomatis
            </div>

            {#if error}
                <div
                    class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
                >
                    <i class="fas fa-exclamation-circle text-red-500"></i>
                    <p class="text-sm text-red-700">{error}</p>
                </div>
            {/if}

            {#if success}
                <div
                    class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3"
                >
                    <i class="fas fa-check-circle text-green-500"></i>
                    <p class="text-sm text-green-700">{success}</p>
                </div>
            {/if}

            <button
                on:click={startScanning}
                class="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
                <i class="fas fa-camera"></i>
                <span>Mulai Pindai</span>
            </button>
        </div>

        <!-- Recent Attendance -->
        {#if recentAttendance.length > 0}
            <div
                class="bg-white rounded-lg shadow p-6 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
                <h3
                    class="text-lg font-semibold text-gray-900 mb-4 dark:text-white"
                >
                    <i class="fas fa-history mr-2"></i>
                    Riwayat Kehadiran Terbaru
                </h3>

                <div class="space-y-3">
                    {#each recentAttendance as attendance}
                        <div
                            class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            <div class="flex-1">
                                <p
                                    class="text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    {attendance.schedule.subject}
                                </p>
                                <p
                                    class="text-xs text-gray-500 dark:text-gray-400"
                                >
                                    {attendance.schedule.class} • {new Date(
                                        attendance.checkInTime,
                                    ).toLocaleDateString()}
                                    {new Date(
                                        attendance.checkInTime,
                                    ).toLocaleTimeString()}
                                </p>
                            </div>
                            <div class="flex items-center gap-2">
                                <span
                                    class="px-2 py-1 text-xs font-medium rounded-full {getStatusColor(
                                        attendance.status,
                                    )}"
                                >
                                    {getStatusLabel(attendance.status)}
                                </span>
                                {#if attendance.method === "QR"}
                                    <i
                                        class="fas fa-qrcode text-indigo-600"
                                        title="QR Code"
                                    ></i>
                                {:else}
                                    <i
                                        class="fas fa-clipboard-list text-purple-600"
                                        title="Manual"
                                    ></i>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</Layout>

<!-- QR Scanner Modal -->
{#if showScanModal}
    <div
        class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
    >
        <div class="bg-white rounded-lg max-w-lg w-full p-6 relative">
            <!-- Loading Overlay -->
            {#if isSubmitting}
                <div
                    class="absolute inset-0 bg-white bg-opacity-95 rounded-lg flex flex-col items-center justify-center z-10"
                >
                    <i
                        class="fas fa-spinner fa-spin text-5xl text-primary-600 mb-4"
                    ></i>
                    <p class="text-lg font-semibold text-gray-900">
                        Memproses kehadiran...
                    </p>
                    <p class="text-sm text-gray-600 mt-2">
                        Mohon tunggu sebentar
                    </p>
                </div>
            {/if}

            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-semibold text-gray-900">
                    <i class="fas fa-qrcode mr-2"></i>
                    Pindai Kode QR
                </h3>
                <button
                    on:click={stopScanning}
                    disabled={isSubmitting}
                    class="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>

            <div
                class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700"
            >
                <i class="fas fa-info-circle mr-2"></i>
                Arahkan kamera ke kode QR jadwal
            </div>

            <div
                id="qr-reader"
                class="rounded-lg overflow-hidden bg-black"
            ></div>

            <button
                on:click={stopScanning}
                disabled={isSubmitting}
                class="w-full mt-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <i class="fas fa-stop mr-2"></i>
                Berhenti Memindai
            </button>
        </div>
    </div>
{/if}
