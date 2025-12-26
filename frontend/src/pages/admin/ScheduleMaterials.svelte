<script>
    import Layout from "../../components/Layout.svelte";
    import LoadingOverlay from "../../components/LoadingOverlay.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { toastStore } from "../../stores/toast.js";
    import { onMount } from "svelte";
    import { pop } from "svelte-spa-router";

    export let params = {};

    let scheduleId = params.id;
    let schedule = null;
    let sections = [];
    let loading = true;
    let processing = false;
    let processingMessage = "";

    // Modal states
    let showAddSectionModal = false;
    let showEditSectionModal = false;
    let showUploadModal = false;
    let newSectionTitle = "";
    let editingSectionId = null;
    let editingSectionTitle = "";

    // Upload state
    let selectedSectionId = null;
    let uploadForm = {
        title: "",
        description: "",
        file: null,
    };
    let fileInput;

    onMount(async () => {
        if (!scheduleId) {
            toastStore.error("Invalid schedule ID");
            pop();
            return;
        }
        await loadData();
    });

    async function loadData() {
        loading = true;
        try {
            // Load schedule details (reuse existing endpoint or fetch from list if cached? better fetch fresh)
            // We only need basic info, but /schedules returns array.
            // We might need a single schedule endpoint or filter client side if we already have it?
            // Actually, we can just fetch sections first, and maybe assume schedule info is known or fetch it.
            // Let's assume we can fetch schedule info. It seems we don't have a specific "get single schedule" endpoint
            // exposed publicly in api/index.js (except for PUT/DELETE usually).
            // Wait, looking at api/index.js, there isn't a "GET /api/schedules/:id".
            // But we can filter from the list if needed, or just fetch sections.
            // Let's try to fetch sections first.
            await fetchSections();

            // To get schedule name/subject, we might need to fetch all schedules and find it
            // or implement a single GET endpoint.
            // For now, let's fetch all schedules and find this one.
            const response = await fetch(`${API_URL}/schedules`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });
            if (response.ok) {
                const schedules = await response.json();
                schedule = schedules.find((s) => s.id === scheduleId);
            }
        } catch (error) {
            console.error("Error loading data:", error);
            toastStore.error("Failed to load schedule data");
        } finally {
            loading = false;
        }
    }

    async function fetchSections() {
        const response = await fetch(
            `${API_URL}/schedules/${scheduleId}/sections`,
            {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            },
        );
        if (response.ok) {
            sections = await response.json();
        }
    }

    async function createSection() {
        if (!newSectionTitle.trim()) return;

        processing = true;
        processingMessage = "Creating section...";
        try {
            const response = await fetch(
                `${API_URL}/schedules/${scheduleId}/sections`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${auth.getToken()}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ title: newSectionTitle }),
                },
            );

            if (response.ok) {
                await fetchSections();
                showAddSectionModal = false;
                newSectionTitle = "";
                toastStore.success("Section created successfully");
            } else {
                toastStore.error("Failed to create section");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        } finally {
            processing = false;
        }
    }

    function openEditSectionModal(section) {
        editingSectionId = section.id;
        editingSectionTitle = section.title;
        showEditSectionModal = true;
    }

    async function updateSection() {
        if (!editingSectionTitle.trim()) return;

        processing = true;
        processingMessage = "Updating section...";
        try {
            const response = await fetch(
                `${API_URL}/sections/${editingSectionId}`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${auth.getToken()}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ title: editingSectionTitle }),
                },
            );

            if (response.ok) {
                await fetchSections();
                showEditSectionModal = false;
                editingSectionId = null;
                editingSectionTitle = "";
                toastStore.success("Section updated successfully");
            } else {
                toastStore.error("Failed to update section");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        } finally {
            processing = false;
        }
    }

    async function deleteSection(sectionId, sectionTitle) {
        if (
            !confirm(
                `Apakah anda yakin ingin menghapus section "${sectionTitle}"?\n\nSemua materi dalam section ini juga akan dihapus.`,
            )
        )
            return;

        processing = true;
        processingMessage = "Deleting section...";
        try {
            const response = await fetch(`${API_URL}/sections/${sectionId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (response.ok) {
                await fetchSections();
                toastStore.success("Section deleted successfully");
            } else {
                toastStore.error("Failed to delete section");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        } finally {
            processing = false;
        }
    }

    function openUploadModal(sectionId) {
        selectedSectionId = sectionId;
        uploadForm = { title: "", description: "", file: null };
        if (fileInput) fileInput.value = "";
        showUploadModal = true;
    }

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.type !== "application/pdf") {
                toastStore.error("Only PDF files are allowed");
                event.target.value = "";
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                toastStore.error("File size must be less than 10MB");
                event.target.value = "";
                return;
            }
            uploadForm.file = file;
            if (!uploadForm.title) {
                uploadForm.title = file.name.replace(".pdf", "");
            }
        }
    }

    async function uploadMaterial() {
        if (!uploadForm.file || !uploadForm.title) {
            toastStore.error("Please fill all required fields");
            return;
        }

        // Check file size - strict 5MB limit
        const fileSizeMB = uploadForm.file.size / 1024 / 1024;
        if (fileSizeMB > 5) {
            alert(
                `⚠️ File terlalu besar!\n\n` +
                    `Ukuran: ${fileSizeMB.toFixed(2)} MB\n` +
                    `Maksimum: 5 MB\n\n` +
                    `Silakan compress PDF terlebih dahulu:\n` +
                    `• ilovepdf.com/compress_pdf\n` +
                    `• smallpdf.com/compress-pdf`,
            );
            return;
        }

        processing = true;
        processingMessage = "Uploading material...";

        const formData = new FormData();
        formData.append("file", uploadForm.file);
        formData.append("title", uploadForm.title);
        formData.append("description", uploadForm.description);

        try {
            const response = await fetch(
                `${API_URL}/sections/${selectedSectionId}/materials`,
                {
                    method: "POST",
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                    body: formData,
                },
            );

            if (response.ok) {
                await fetchSections(); // Refresh list
                showUploadModal = false;
                toastStore.success("Material uploaded successfully");
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Failed to upload material");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        } finally {
            processing = false;
        }
    }

    async function deleteMaterial(id) {
        if (!confirm("Apakah anda yakin ingin menghapus materi ini?")) return;

        processing = true;
        processingMessage = "Deleting...";
        try {
            const response = await fetch(`${API_URL}/materials/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (response.ok) {
                await fetchSections();
                toastStore.success("Materi dihapus");
            } else {
                toastStore.error("Gagal menghapus materi");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        } finally {
            processing = false;
        }
    }

    async function downloadMaterial(material) {
        try {
            const response = await fetch(
                `${API_URL}/materials/${material.id}/download`,
                {
                    headers: { Authorization: `Bearer ${auth.getToken()}` },
                },
            );

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = material.fileName;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                toastStore.error("Gagal mengunduh file");
            }
        } catch (error) {
            toastStore.error("Error: " + error.message);
        }
    }
</script>

<Layout activePage="/schedules" title="Manage Materials">
    {#if loading}
        <div class="flex justify-center items-center h-64">
            <i class="fas fa-spinner fa-spin text-4xl text-primary-600"></i>
        </div>
    {:else}
        <!-- Header -->
        <div class="mb-6">
            <button
                on:click={() => pop()}
                class="mb-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-2 transition-colors"
            >
                <i class="fas fa-arrow-left"></i>
                Kembali ke Jadwal
            </button>

            <div class="flex justify-between items-start">
                <div>
                    <h2
                        class="text-3xl font-bold text-gray-900 dark:text-white"
                    >
                        {#if schedule}
                            {schedule.subject} - {schedule.class}
                        {:else}
                            Materi Pengajaran dan Tugas
                        {/if}
                    </h2>
                    <p class="text-gray-600 dark:text-gray-400 mt-1">
                        Materi Pengajaran dan Tugas
                    </p>
                </div>
                <!-- <button
                    on:click={() => (showAddSectionModal = true)}
                    class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-md transition-all flex items-center gap-2"
                >
                    <i class="fas fa-plus"></i>
                    Add Section
                </button> -->
            </div>
            <!-- Add Section Button (Full Width Mobile / Auto Desktop) -->
            <div class="mt-4">
                {#if $auth.user?.role === "ADMIN"}
                    <button
                        on:click={() => (showAddSectionModal = true)}
                        class="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                    >
                        <i class="fas fa-plus-circle"></i>
                        Tambah Topik / Section
                    </button>
                {/if}
            </div>
        </div>

        <!-- Sections List -->
        <div class="space-y-6">
            {#if sections.length === 0}
                <div
                    class="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700"
                >
                    <div
                        class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4"
                    >
                        <i class="fas fa-folder-open text-3xl text-gray-400"
                        ></i>
                    </div>
                    <!-- jika user maka muncul teks belum ada topik -->
                    {#if $auth.user?.role !== "ADMIN"}
                        <h3
                            class="text-lg font-medium text-gray-900 dark:text-white mb-1"
                        >
                            Belum ada topik tersedia
                        </h3>
                        <p class="text-gray-500 dark:text-gray-400 mb-4">
                            Hubungi administrator untuk menambahkan topik
                        </p>
                    {:else}
                    <h3
                        class="text-lg font-medium text-gray-900 dark:text-white mb-1"
                    >
                        Tidak ada topik
                    </h3>
                    <p class="text-gray-500 dark:text-gray-400 mb-4">
                        Tambahkan topik untuk memulai mengunggah materi
                    </p>
                    {#if $auth.user?.role === "ADMIN"}
                        <button
                            on:click={() => (showAddSectionModal = true)}
                            class="text-primary-600 hover:text-primary-700 font-medium"
                        >
                            Tambahkan topik
                        </button>
                    {/if}
                    {/if}
                </div>
            {:else}
                {#each sections as section (section.id)}
                    <div
                        class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                        <!-- Section Header -->
                        <div
                            class="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center"
                        >
                            <h3
                                class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"
                            >
                                <i
                                    class="fas fa-chevron-down text-gray-400 text-sm"
                                ></i>
                                {section.title}
                            </h3>
                            {#if $auth.user?.role === "ADMIN"}
                                <div class="flex items-center gap-2">
                                    <button
                                        on:click={() => openEditSectionModal(section)}
                                        class="text-sm px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                                        title="Edit Section"
                                    >
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button
                                        on:click={() => deleteSection(section.id, section.title)}
                                        class="text-sm px-3 py-1.5 bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                                        title="Delete Section"
                                    >
                                        <i class="fas fa-trash"></i>
                                    </button>
                                    <button
                                        on:click={() => openUploadModal(section.id)}
                                        class="text-sm px-3 py-1.5 bg-white dark:bg-gray-700 text-primary-600 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                                    >
                                        <i class="fas fa-cloud-upload-alt"></i>
                                        Upload
                                    </button>
                                </div>
                            {/if}
                        </div>

                        <!-- Materials List -->
                        <div
                            class="divide-y divide-gray-100 dark:divide-gray-700/50"
                        >
                            {#if section.materials.length === 0}
                                <div
                                    class="p-6 text-center text-sm text-gray-500 dark:text-gray-400 italic"
                                >
                                    No materials uploaded yet
                                </div>
                            {:else}
                                {#each section.materials as material (material.id)}
                                    <div
                                        class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors flex items-center gap-4 group"
                                    >
                                        <div
                                            class="w-10 h-10 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg flex items-center justify-center flex-shrink-0"
                                        >
                                            <i class="fas fa-file-pdf text-xl"
                                            ></i>
                                        </div>

                                        <div class="flex-1 min-w-0">
                                            <h4
                                                class="text-sm font-medium text-gray-900 dark:text-white truncate"
                                            >
                                                {material.title}
                                            </h4>
                                            {#if material.description}
                                                <p
                                                    class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5"
                                                >
                                                    {material.description}
                                                </p>
                                            {/if}
                                            <div
                                                class="flex items-center gap-3 mt-1 text-xs text-gray-400"
                                            >
                                                <span
                                                    >{(
                                                        material.fileSize /
                                                        1024 /
                                                        1024
                                                    ).toFixed(2)} MB</span
                                                >
                                                <span>•</span>
                                                <span
                                                    >{new Date(
                                                        material.createdAt,
                                                    ).toLocaleDateString()}</span
                                                >
                                            </div>
                                        </div>

                                        <div
                                            class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <button
                                                on:click={() =>
                                                    downloadMaterial(material)}
                                                class="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                                                title="Download"
                                            >
                                                <i class="fas fa-download"></i>
                                            </button>
                                            {#if $auth.user?.role === "ADMIN"}
                                                <button
                                                    on:click={() =>
                                                        deleteMaterial(
                                                            material.id,
                                                        )}
                                                    class="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                    title="Delete"
                                                >
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            {/if}
                                        </div>
                                        <!-- Mobile actions always visible -->
                                        <div
                                            class="flex sm:hidden items-center gap-2"
                                        >
                                            <button
                                                on:click={() =>
                                                    downloadMaterial(material)}
                                                class="p-2 text-primary-600"
                                            >
                                                <i class="fas fa-download"></i>
                                            </button>
                                        </div>
                                    </div>
                                {/each}
                            {/if}
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    {/if}
</Layout>

<!-- Add Section Modal -->
{#if showAddSectionModal}
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl"
        >
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Tambah Topik / Section
            </h3>
            <div class="space-y-4">
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >Judul Topik</label
                    >
                    <input
                        type="text"
                        bind:value={newSectionTitle}
                        placeholder="e.g., Introduction to AI"
                        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500"
                        autoFocus
                    />
                </div>
                <div class="flex justify-end gap-3 mt-6">
                    <button
                        on:click={() => (showAddSectionModal = false)}
                        class="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        on:click={createSection}
                        disabled={!newSectionTitle.trim()}
                        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Tambah Topik
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Edit Section Modal -->
{#if showEditSectionModal}
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl"
        >
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Edit Topik / Section
            </h3>
            <div class="space-y-4">
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >Judul Topik</label
                    >
                    <input
                        type="text"
                        bind:value={editingSectionTitle}
                        placeholder="e.g., Introduction to AI"
                        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500"
                        autoFocus
                    />
                </div>
                <div class="flex justify-end gap-3 mt-6">
                    <button
                        on:click={() => (showEditSectionModal = false)}
                        class="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        on:click={updateSection}
                        disabled={!editingSectionTitle.trim()}
                        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Update
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Upload Modal -->
{#if showUploadModal}
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl"
        >
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Upload PDF Materi
            </h3>
            <div class="space-y-4">
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >Judul</label
                    >
                    <input
                        type="text"
                        bind:value={uploadForm.title}
                        placeholder="Judul materi"
                        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500"
                    />
                </div>
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >Deskripsi (Opsional)</label
                    >
                    <textarea
                        bind:value={uploadForm.description}
                        placeholder="Deskripsi materi..."
                        rows="2"
                        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500"
                    ></textarea>
                </div>
                <div>
                    <label
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >PDF File</label
                    >
                    <div
                        class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                        {#if uploadForm.file}
                            <div
                                class="flex items-center justify-center gap-2 text-green-600 dark:text-green-400"
                            >
                                <i class="fas fa-check-circle"></i>
                                <span class="font-medium"
                                    >{uploadForm.file.name}</span
                                >
                            </div>
                            <button
                                on:click={() => {
                                    uploadForm.file = null;
                                    fileInput.value = "";
                                }}
                                class="text-sm text-red-500 hover:text-red-600 mt-2 hover:underline"
                            >
                                Hapus file
                            </button>
                        {:else}
                            <i
                                class="fas fa-file-pdf text-4xl text-gray-400 mb-2"
                            ></i>
                            <p
                                class="text-sm text-gray-500 dark:text-gray-400 mb-2"
                            >
                                Klik untuk memilih PDF
                            </p>
                            <input
                                type="file"
                                accept="application/pdf"
                                bind:this={fileInput}
                                on:change={handleFileSelect}
                                class="text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-primary-50 file:text-primary-700
                                hover:file:bg-primary-100"
                            />
                        {/if}
                    </div>
                </div>

                <div class="flex justify-end gap-3 mt-6">
                    <button
                        on:click={() => (showUploadModal = false)}
                        class="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        on:click={uploadMaterial}
                        disabled={!uploadForm.file || !uploadForm.title}
                        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Upload
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<LoadingOverlay show={processing} message={processingMessage} />
