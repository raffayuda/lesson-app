<script>
    import { onMount } from "svelte";
    import Layout from "../../components/Layout.svelte";
    import LoadingOverlay from "../../components/LoadingOverlay.svelte";
    import Modal from "../../components/Modal.svelte";
    import { auth } from "../../stores/auth.js";
    import { toastStore } from "../../stores/toast.js";

    const API_URL = import.meta.env.VITE_API_URL || "/api";

    let materials = [];
    let loading = false;
    let processing = false;
    let processingMessage = "";

    // Modal states
    let showUploadModal = false;
    let showDeleteModal = false;
    let selectedMaterial = null;

    // Form data
    let uploadForm = {
        title: "",
        class: "",
        subject: "",
        description: "",
        file: null,
    };
    let uploadSubmitting = false;
    let filePreview = null;

    // Available classes
    const classes = [
        "X RPL",
        "X TKJ",
        "X SIJA",
        "XI RPL",
        "XI TKJ",
        "XI SIJA",
        "XII RPL",
        "XII TKJ",
        "XII SIJA",
    ];

    onMount(() => {
        fetchMaterials();
    });

    async function fetchMaterials() {
        loading = true;
        try {
            const response = await fetch(`${API_URL}/materials`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (response.ok) {
                materials = await response.json();
            } else {
                toastStore.error("Gagal memuat data materi");
            }
        } catch (error) {
            console.error("Error:", error);
            toastStore.error("Error: " + error.message);
        } finally {
            loading = false;
        }
    }

    function openUploadModal() {
        uploadForm = {
            title: "",
            class: "",
            subject: "",
            description: "",
            file: null,
        };
        filePreview = null;
        showUploadModal = true;
    }

    function handleFileChange(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.type !== "application/pdf") {
                toastStore.error("Hanya file PDF yang diperbolehkan");
                event.target.value = "";
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                // 10MB limit
                toastStore.error("Ukuran file maksimal 10MB");
                event.target.value = "";
                return;
            }
            uploadForm.file = file;
            filePreview = file.name;
        }
    }

    async function submitUpload() {
        if (
            !uploadForm.title ||
            !uploadForm.class ||
            !uploadForm.subject ||
            !uploadForm.file
        ) {
            toastStore.warning("Semua field wajib diisi");
            return;
        }

        uploadSubmitting = true;
        try {
            const formData = new FormData();
            formData.append("title", uploadForm.title);
            formData.append("class", uploadForm.class);
            formData.append("subject", uploadForm.subject);
            formData.append("description", uploadForm.description);
            formData.append("file", uploadForm.file);

            const response = await fetch(`${API_URL}/materials`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${auth.getToken()}`,
                },
                body: formData,
            });

            if (response.ok) {
                toastStore.success("Materi berhasil diunggah!");
                showUploadModal = false;
                await fetchMaterials();
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Gagal mengunggah materi");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        } finally {
            uploadSubmitting = false;
        }
    }

    function confirmDelete(material) {
        selectedMaterial = material;
        showDeleteModal = true;
    }

    async function deleteMaterial() {
        if (!selectedMaterial) return;

        processing = true;
        processingMessage = "Menghapus materi...";
        try {
            const response = await fetch(
                `${API_URL}/materials/${selectedMaterial.id}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                },
            );

            if (response.ok) {
                toastStore.success("Materi berhasil dihapus!");
                showDeleteModal = false;
                await fetchMaterials();
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Gagal menghapus materi");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        } finally {
            processing = false;
            selectedMaterial = null;
        }
    }

    function downloadMaterial(material) {
        window.open(`${API_URL}/materials/${material.id}/download`, "_blank");
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (
            Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
        );
    }
</script>

<Layout activePage="/materials" title="Manajemen Materi">
    <div class="space-y-6">
        <!-- Header -->
        <div
            class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                <i class="fas fa-book mr-2"></i>
                Manajemen Materi
            </h2>
            <button
                on:click={openUploadModal}
                class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2"
            >
                <i class="fas fa-upload"></i>
                <span>Upload Materi</span>
            </button>
        </div>

        <!-- Materials List -->
        <div
            class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
        >
            {#if loading}
                <div class="flex items-center justify-center p-12">
                    <i class="fas fa-spinner fa-spin text-3xl text-primary-600"
                    ></i>
                </div>
            {:else if materials.length === 0}
                <div class="text-center py-12 text-gray-500 dark:text-gray-400">
                    <i class="fas fa-inbox text-5xl mb-4"></i>
                    <p>Belum ada materi yang diunggah</p>
                </div>
            {:else}
                <div class="overflow-x-auto">
                    <table
                        class="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
                    >
                        <thead class="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                    >Judul</th
                                >
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                    >Kelas</th
                                >
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                    >Mata Pelajaran</th
                                >
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                    >Ukuran File</th
                                >
                                <th
                                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                    >Tanggal Upload</th
                                >
                                <th
                                    class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase"
                                    >Aksi</th
                                >
                            </tr>
                        </thead>
                        <tbody
                            class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
                        >
                            {#each materials as material}
                                <tr
                                    class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                                >
                                    <td class="px-6 py-4">
                                        <div class="flex items-center gap-3">
                                            <div
                                                class="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center"
                                            >
                                                <i
                                                    class="fas fa-file-pdf text-red-600"
                                                ></i>
                                            </div>
                                            <div>
                                                <p
                                                    class="text-sm font-medium text-gray-900 dark:text-white"
                                                >
                                                    {material.title}
                                                </p>
                                                {#if material.description}
                                                    <p
                                                        class="text-xs text-gray-500 dark:text-gray-400"
                                                    >
                                                        {material.description}
                                                    </p>
                                                {/if}
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-4 py-4 whitespace-nowrap">
                                        <span
                                            class="px-2 py-1 text-xs font-medium rounded-lg bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400"
                                        >
                                            {material.class}
                                        </span>
                                    </td>
                                    <td
                                        class="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white"
                                    >
                                        {material.subject}
                                    </td>
                                    <td
                                        class="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
                                    >
                                        {formatFileSize(material.fileSize)}
                                    </td>
                                    <td
                                        class="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
                                    >
                                        {new Date(
                                            material.createdAt,
                                        ).toLocaleDateString("id-ID")}
                                    </td>
                                    <td
                                        class="px-4 py-4 whitespace-nowrap text-right text-sm font-medium"
                                    >
                                        <div
                                            class="flex items-center justify-end gap-2"
                                        >
                                            <button
                                                on:click={() =>
                                                    downloadMaterial(material)}
                                                class="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="Download"
                                            >
                                                <i class="fas fa-download"></i>
                                            </button>
                                            <button
                                                on:click={() =>
                                                    confirmDelete(material)}
                                                class="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Hapus"
                                            >
                                                <i class="fas fa-trash"></i>
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
    </div>
</Layout>

<!-- Upload Modal -->
{#if showUploadModal}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        on:click={() => {
            showUploadModal = false;
            uploadForm = {
                title: "",
                class: "",
                subject: "",
                description: "",
                file: null,
            };
            filePreview = null;
        }}
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            on:click|stopPropagation
        >
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
                <i class="fas fa-upload mr-2 text-primary-600"></i>
                Upload Materi Baru
            </h3>

            <form on:submit|preventDefault={submitUpload} class="space-y-4">
                <!-- Title -->
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                        Judul Materi <span class="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        bind:value={uploadForm.title}
                        required
                        class="w-full px-3 py-2 border dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                        placeholder="Contoh: Pengenalan Algoritma"
                    />
                </div>

                <!-- Class -->
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                        Kelas <span class="text-red-500">*</span>
                    </label>
                    <select
                        bind:value={uploadForm.class}
                        required
                        class="w-full px-3 py-2 border dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                    >
                        <option value="">Pilih Kelas</option>
                        {#each classes as cls}
                            <option value={cls}>{cls}</option>
                        {/each}
                    </select>
                </div>

                <!-- Subject -->
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                        Mata Pelajaran <span class="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        bind:value={uploadForm.subject}
                        required
                        class="w-full px-3 py-2 border dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                        placeholder="Contoh: Pemrograman Dasar"
                    />
                </div>

                <!-- Description -->
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                        Deskripsi (Opsional)
                    </label>
                    <textarea
                        bind:value={uploadForm.description}
                        rows="3"
                        class="w-full px-3 py-2 border dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                        placeholder="Deskripsi singkat tentang materi..."
                    ></textarea>
                </div>

                <!-- File Upload -->
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                        File PDF <span class="text-red-500">*</span>
                    </label>
                    <input
                        type="file"
                        accept=".pdf"
                        on:change={handleFileChange}
                        required
                        class="w-full px-3 py-2 border dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Format: PDF (Maks. 10MB)
                    </p>
                    {#if filePreview}
                        <div
                            class="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded flex items-center gap-2"
                        >
                            <i class="fas fa-file-pdf text-red-600"></i>
                            <span
                                class="text-sm text-gray-700 dark:text-gray-300"
                                >{filePreview}</span
                            >
                        </div>
                    {/if}
                </div>

                <!-- Buttons -->
                <div class="flex gap-3 justify-end pt-4">
                    <button
                        type="button"
                        on:click={() => {
                            showUploadModal = false;
                            uploadForm = {
                                title: "",
                                class: "",
                                subject: "",
                                description: "",
                                file: null,
                            };
                            filePreview = null;
                        }}
                        class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg"
                        disabled={uploadSubmitting}
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
                        disabled={uploadSubmitting}
                    >
                        {#if uploadSubmitting}
                            <i class="fas fa-spinner fa-spin mr-2"></i>
                            Mengunggah...
                        {:else}
                            <i class="fas fa-upload mr-2"></i>
                            Upload Materi
                        {/if}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<!-- Delete Confirmation Modal -->
<Modal
    bind:show={showDeleteModal}
    title="Hapus Materi"
    message={`Apakah Anda yakin ingin menghapus materi "${selectedMaterial?.title}"? Tindakan ini tidak dapat dibatalkan.`}
    danger={true}
    on:confirm={deleteMaterial}
/>

<!-- Loading Overlay -->
<LoadingOverlay show={processing} message={processingMessage} />
