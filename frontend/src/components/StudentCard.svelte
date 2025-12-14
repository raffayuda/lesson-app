<script>
    export let student;
    export let onEdit;
    export let onDelete;
    export let onViewQR;

    import QRCode from "qrcode";
    import { onMount } from "svelte";

    let qrDataUrl = "";

    onMount(async () => {
        try {
            qrDataUrl = await QRCode.toDataURL(student.qrCode, {
                width: 200,
                margin: 1,
                color: {
                    dark: "#0f172a",
                    light: "#ffffff",
                },
            });
        } catch (error) {
            console.error("Error generating QR code:", error);
        }
    });

    function downloadQR() {
        const link = document.createElement("a");
        link.download = `${student.studentId}-${student.name}.png`;
        link.href = qrDataUrl;
        link.click();
    }
</script>

<div
    class="bg-primary-900/50 backdrop-blur-sm border border-primary-800 rounded-lg p-6 hover:border-primary-700 transition-all duration-200"
>
    <div class="flex gap-4">
        <!-- QR Code -->
        <div class="flex-shrink-0">
            <div
                class="w-24 h-24 bg-white rounded-lg p-2 cursor-pointer hover:scale-105 transition-transform"
                on:click={() => onViewQR(student)}
            >
                {#if qrDataUrl}
                    <img src={qrDataUrl} alt="QR Code" class="w-full h-full" />
                {:else}
                    <div
                        class="w-full h-full bg-primary-200 animate-pulse rounded"
                    ></div>
                {/if}
            </div>
        </div>

        <!-- Student Info -->
        <div class="flex-1 min-w-0">
            <h3 class="text-lg font-semibold text-primary-50 truncate">
                {student.name}
            </h3>
            <p class="text-primary-400 text-sm">ID: {student.studentId}</p>
            <p class="text-primary-400 text-sm">Class: {student.class}</p>
            {#if student._count}
                <p class="text-primary-500 text-xs mt-1">
                    {student._count.attendances} attendance records
                </p>
            {/if}
        </div>

        <!-- Actions -->
        <div class="flex flex-col gap-2">
            <button
                on:click={downloadQR}
                class="px-3 py-1.5 text-xs bg-primary-800 hover:bg-primary-700 text-primary-100 rounded transition-colors"
                title="Download QR"
            >
                ⬇️ QR
            </button>
            <button
                on:click={() => onEdit(student)}
                class="px-3 py-1.5 text-xs bg-primary-800 hover:bg-primary-700 text-primary-100 rounded transition-colors"
                title="Edit"
            >
                ✏️ Edit
            </button>
            <button
                on:click={() => onDelete(student.id)}
                class="px-3 py-1.5 text-xs bg-red-900/50 hover:bg-red-900 text-red-100 rounded transition-colors"
                title="Delete"
            >
                🗑️ Del
            </button>
        </div>
    </div>
</div>
