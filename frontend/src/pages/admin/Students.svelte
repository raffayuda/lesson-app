<script>
    import Layout from "../../components/Layout.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { onMount } from "svelte";
    import QRCode from "qrcode";

    let students = [];
    let loading = true;
    let showModal = false;
    let showQRModal = false;
    let editingId = null;
    let selectedStudent = null;
    let qrDataUrl = "";

    let form = {
        name: "",
        email: "",
        studentId: "",
        class: "",
        password: "",
    };

    onMount(() => {
        fetchStudents();
    });

    async function fetchStudents() {
        loading = true;
        try {
            const response = await fetch(`${API_URL}/students`, {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });
            if (response.ok) {
                students = await response.json();
            }
        } catch (error) {
            console.error("Error:", error);
        } finally {
            loading = false;
        }
    }

    function openModal(student = null) {
        if (student) {
            editingId = student.id;
            form = {
                name: student.user.name,
                email: student.user.email,
                studentId: student.studentId,
                class: student.class,
                password: "",
            };
        } else {
            editingId = null;
            form = {
                name: "",
                email: "",
                studentId: "",
                class: "",
                password: "",
            };
        }
        showModal = true;
    }

    async function handleSubmit() {
        try {
            const url = editingId
                ? `${API_URL}/students/${editingId}`
                : `${API_URL}/students`;
            const method = editingId ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${auth.getToken()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(form),
            });

            if (response.ok) {
                showModal = false;
                fetchStudents();
            } else {
                const data = await response.json();
                alert(data.error || "Failed to save student");
            }
        } catch (error) {
            alert("Error: " + error.message);
        }
    }

    async function deleteStudent(id) {
        if (
            !confirm(
                "Delete this student? This will also delete their user account.",
            )
        )
            return;

        try {
            const response = await fetch(`${API_URL}/students/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (response.ok) {
                fetchStudents();
            }
        } catch (error) {
            alert("Error: " + error.message);
        }
    }

    async function viewQR(student) {
        selectedStudent = student;
        try {
            qrDataUrl = await QRCode.toDataURL(student.qrCode, {
                width: 300,
                margin: 2,
            });
            showQRModal = true;
        } catch (error) {
            alert("Error generating QR code");
        }
    }

    function downloadQR() {
        const link = document.createElement("a");
        link.download = `${selectedStudent.studentId}-${selectedStudent.user.name}.png`;
        link.href = qrDataUrl;
        link.click();
    }
</script>

<Layout activePage="/students" title="Students Management">
    <div class="space-y-6">
        <div class="flex justify-between items-center">
            <h2 class="text-2xl font-bold text-gray-900">Students</h2>
            <button
                on:click={() => openModal()}
                class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2"
            >
                <i class="fas fa-user-plus"></i>
                <span>Add Student</span>
            </button>
        </div>

        {#if loading}
            <div class="flex justify-center py-20">
                <i class="fas fa-spinner fa-spin text-4xl text-primary-500"></i>
            </div>
        {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {#each students as student}
                    <div
                        class="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
                    >
                        <div class="flex items-start justify-between mb-4">
                            <div class="flex-1">
                                <h3 class="text-lg font-semibold text-gray-900">
                                    {student.user.name}
                                </h3>
                                <p class="text-sm text-gray-500">
                                    ID: {student.studentId}
                                </p>
                                <p class="text-sm text-gray-500">
                                    Class: {student.class}
                                </p>
                                <p class="text-sm text-gray-500">
                                    {student.user.email}
                                </p>
                            </div>
                            <button
                                on:click={() => viewQR(student)}
                                class="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200"
                            >
                                <i class="fas fa-qrcode text-2xl text-gray-600"
                                ></i>
                            </button>
                        </div>
                        <div class="flex gap-2">
                            <button
                                on:click={() => openModal(student)}
                                class="flex-1 px-3 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 text-sm"
                            >
                                <i class="fas fa-edit mr-1"></i> Edit
                            </button>
                            <button
                                on:click={() => deleteStudent(student.id)}
                                class="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm"
                            >
                                <i class="fas fa-trash mr-1"></i> Delete
                            </button>
                        </div>
                    </div>
                {:else}
                    <div class="col-span-full text-center py-20 text-gray-500">
                        <i class="fas fa-users text-4xl mb-2"></i>
                        <p>No students yet. Add your first student!</p>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</Layout>

{#if showModal}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
        <div class="bg-white rounded-lg max-w-md w-full p-6">
            <h3 class="text-xl font-semibold mb-4">
                {editingId ? "Edit" : "Add"} Student
            </h3>

            <form on:submit|preventDefault={handleSubmit} class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Name</label
                    >
                    <input
                        bind:value={form.name}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Email</label
                    >
                    <input
                        type="email"
                        bind:value={form.email}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Student ID (NIS)</label
                    >
                    <input
                        bind:value={form.studentId}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Class</label
                    >
                    <input
                        bind:value={form.class}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                </div>
                {#if !editingId}
                    <div>
                        <label
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >Password (optional)</label
                        >
                        <input
                            type="password"
                            bind:value={form.password}
                            placeholder="Leave empty for auto-generated"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        />
                        <p class="text-xs text-gray-500 mt-1">
                            Default: student{"{studentId}"}
                        </p>
                    </div>
                {/if}

                <div class="flex gap-3 justify-end pt-4">
                    <button
                        type="button"
                        on:click={() => (showModal = false)}
                        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                    >
                        <i class="fas fa-save mr-2"></i>
                        Save
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

{#if showQRModal && selectedStudent}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        on:click={() => (showQRModal = false)}
    >
        <div
            class="bg-white rounded-lg max-w-sm w-full p-6"
            on:click|stopPropagation
        >
            <h3 class="text-xl font-semibold mb-4">QR Code</h3>
            <div class="text-center space-y-4">
                <div class="bg-white p-4 rounded-lg inline-block">
                    <img src={qrDataUrl} alt="QR Code" class="w-64 h-64" />
                </div>
                <div>
                    <p class="font-semibold text-gray-900">
                        {selectedStudent.user.name}
                    </p>
                    <p class="text-sm text-gray-500">
                        ID: {selectedStudent.studentId}
                    </p>
                    <p class="text-sm text-gray-500">
                        Class: {selectedStudent.class}
                    </p>
                </div>
                <button
                    on:click={downloadQR}
                    class="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                >
                    <i class="fas fa-download mr-2"></i>
                    Download QR Code
                </button>
            </div>
        </div>
    </div>
{/if}
