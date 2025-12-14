<script>
    import { onMount, onDestroy } from "svelte";
    import { Html5Qrcode } from "html5-qrcode";

    export let onScan;
    export let onClose;

    let scanner;
    let scanning = false;
    let error = "";

    onMount(async () => {
        try {
            scanner = new Html5Qrcode("qr-reader");
            await startScanning();
        } catch (err) {
            error = "Failed to initialize camera: " + err.message;
            console.error(err);
        }
    });

    async function startScanning() {
        try {
            scanning = true;
            error = "";

            await scanner.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                },
                (decodedText) => {
                    onScan(decodedText);
                    stopScanning();
                },
                (errorMessage) => {
                    // Ignore scan errors, they happen frequently
                },
            );
        } catch (err) {
            error = "Failed to start camera: " + err.message;
            scanning = false;
            console.error(err);
        }
    }

    async function stopScanning() {
        if (scanner && scanning) {
            try {
                await scanner.stop();
                scanning = false;
            } catch (err) {
                console.error("Error stopping scanner:", err);
            }
        }
    }

    onDestroy(async () => {
        await stopScanning();
        if (scanner) {
            scanner.clear();
        }
    });

    async function handleClose() {
        await stopScanning();
        onClose();
    }
</script>

<div
    class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
>
    <div
        class="bg-primary-900 border border-primary-700 rounded-lg max-w-md w-full p-6"
    >
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-semibold text-primary-50">Scan QR Code</h3>
            <button
                on:click={handleClose}
                class="text-primary-400 hover:text-primary-200 text-2xl leading-none"
            >
                ×
            </button>
        </div>

        {#if error}
            <div
                class="bg-red-900/20 border border-red-800 text-red-200 px-4 py-3 rounded mb-4"
            >
                {error}
            </div>
        {/if}

        <div id="qr-reader" class="rounded-lg overflow-hidden bg-black"></div>

        <p class="text-primary-400 text-sm text-center mt-4">
            Position the QR code within the frame
        </p>
    </div>
</div>
