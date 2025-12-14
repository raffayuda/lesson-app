<script>
    export let attendances = [];

    function formatDate(dateString) {
        return new Date(dateString).toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function getStatusColor(status) {
        switch (status) {
            case "present":
                return "bg-green-900/30 text-green-300 border-green-800";
            case "late":
                return "bg-yellow-900/30 text-yellow-300 border-yellow-800";
            case "absent":
                return "bg-red-900/30 text-red-300 border-red-800";
            default:
                return "bg-primary-800 text-primary-300 border-primary-700";
        }
    }

    function getMethodBadge(method) {
        return method === "qr" ? "📱 QR" : "✋ Manual";
    }
</script>

<div class="overflow-x-auto">
    <table class="w-full">
        <thead>
            <tr class="border-b border-primary-800">
                <th
                    class="text-left py-3 px-4 text-primary-400 font-medium text-sm"
                    >Student</th
                >
                <th
                    class="text-left py-3 px-4 text-primary-400 font-medium text-sm"
                    >Class</th
                >
                <th
                    class="text-left py-3 px-4 text-primary-400 font-medium text-sm"
                    >Time</th
                >
                <th
                    class="text-left py-3 px-4 text-primary-400 font-medium text-sm"
                    >Method</th
                >
                <th
                    class="text-left py-3 px-4 text-primary-400 font-medium text-sm"
                    >Status</th
                >
            </tr>
        </thead>
        <tbody>
            {#if attendances.length === 0}
                <tr>
                    <td colspan="5" class="text-center py-12 text-primary-500">
                        <div class="text-4xl mb-2">📭</div>
                        <p>No attendance records yet</p>
                    </td>
                </tr>
            {:else}
                {#each attendances as attendance}
                    <tr
                        class="border-b border-primary-900 hover:bg-primary-900/30 transition-colors"
                    >
                        <td class="py-3 px-4">
                            <div class="font-medium text-primary-100">
                                {attendance.student.name}
                            </div>
                            <div class="text-xs text-primary-500">
                                {attendance.student.studentId}
                            </div>
                        </td>
                        <td class="py-3 px-4 text-primary-300 text-sm"
                            >{attendance.student.class}</td
                        >
                        <td class="py-3 px-4 text-primary-300 text-sm"
                            >{formatDate(attendance.checkInTime)}</td
                        >
                        <td class="py-3 px-4">
                            <span
                                class="text-xs px-2 py-1 rounded bg-primary-800 text-primary-300"
                            >
                                {getMethodBadge(attendance.method)}
                            </span>
                        </td>
                        <td class="py-3 px-4">
                            <span
                                class="text-xs px-2 py-1 rounded border {getStatusColor(
                                    attendance.status,
                                )} capitalize"
                            >
                                {attendance.status}
                            </span>
                        </td>
                    </tr>
                {/each}
            {/if}
        </tbody>
    </table>
</div>
