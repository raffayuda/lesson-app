<script>
    import Layout from "../../components/Layout.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { onMount, onDestroy } from "svelte";
    import { Html5Qrcode } from "html5-qrcode";

    let scanner;
    let scanning = false;
    let showScanModal = false;
    let isProcessing = false; // Prevent multiple scans
    let error = "";
    let success = "";
    let recentAttendance = [];

    onMount(async () => {
        await fetchRecentAttendance();
    });

    async function fetchRecentAttendance() {
        try {
            // Get student ID from auth
            const student = $auth.user.student;
            if (!student) return;

            const response = await fetch(
                `${API_URL}/attendance?studentId=${student.id}`,
                {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                },
            );

            if (response.ok) {
                const all = await response.json();
                recentAttendance = all.slice(0, 5); // Last 5 records
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

        // Wait for modal to render
        setTimeout(async () => {
            try {
                scanner = new Html5Qrcode("qr-reader");
                scanning = true;

                await scanner.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    async (decodedText) => {
                        // Prevent multiple scans
                        if (isProcessing) return;
                        isProcessing = true;

                        await handleScan(decodedText);
                        await stopScanning();
                    },
                    () => {},
                );
            } catch (err) {
                error = "Failed to start camera: " + err.message;
                scanning = false;
                showScanModal = false;
                isProcessing = false;
            }
        }, 100);
    }

    async function stopScanning() {
        if (scanner && scanning) {
            try {
                await scanner.stop();
                scanner.clear();
                scanning = false;
                showScanModal = false;
            } catch (err) {
                console.error("Error stopping scanner:", err);
            }
        }
    }

    async function handleScan(qrCode) {
        try {
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
                success = `✅ Attendance marked for ${data.schedule.subject} - ${data.schedule.class}`;
                error = "";
                await fetchRecentAttendance();
            } else {
                error = data.error || "Failed to mark attendance";
                success = "";
            }
        } catch (err) {
            error = "Failed to mark attendance: " + err.message;
            success = "";
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
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">
                <i class="fas fa-qrcode mr-2"></i>Scan Schedule QR Code
            </h2>

            <div
                class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700"
            >
                <i class="fas fa-info-circle mr-2"></i>
                Scan the QR code displayed for your schedule to mark your attendance
                automatically
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
                <span>Start Scanning</span>
            </button>
        </div>

        <!-- Recent Attendance -->
        {#if recentAttendance.length > 0}
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-history mr-2"></i>
                    Recent Attendance
                </h3>

                <div class="space-y-3">
                    {#each recentAttendance as attendance}
                        <div
                            class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                            <div class="flex-1">
                                <p class="text-sm font-medium text-gray-900">
                                    {attendance.schedule.subject}
                                </p>
                                <p class="text-xs text-gray-500">
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
        <div class="bg-white rounded-lg max-w-lg w-full p-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-semibold text-gray-900">
                    <i class="fas fa-qrcode mr-2"></i>
                    Scan QR Code
                </h3>
                <button
                    on:click={stopScanning}
                    class="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>

            <div
                class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700"
            >
                <i class="fas fa-info-circle mr-2"></i>
                Point your camera at the schedule QR code
            </div>

            <div
                id="qr-reader"
                class="rounded-lg overflow-hidden bg-black"
            ></div>

            <button
                on:click={stopScanning}
                class="w-full mt-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
            >
                <i class="fas fa-stop mr-2"></i>
                Stop Scanning
            </button>
        </div>
    </div>
{/if}
