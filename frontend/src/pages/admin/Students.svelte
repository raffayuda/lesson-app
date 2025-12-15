<script>
    import Layout from "../../components/Layout.svelte";
    import { auth, API_URL } from "../../stores/auth.js";
    import { onMount } from "svelte";

    let students = [];
    let allStudents = []; // For filtering
    let loading = true;
    let showModal = false;
    let editingId = null;

    // Pagination
    let currentPage = 1;
    let limit = 10;
    let totalPages = 1;

    // Filters
    let filterClass = "";
    let searchQuery = "";

    let form = {
        name: "",
        email: "",
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
                allStudents = await response.json();
                applyFiltersAndPagination();
            }
        } catch (error) {
            console.error("Error:", error);
        } finally {
            loading = false;
        }
    }

    function applyFiltersAndPagination() {
        let filtered = [...allStudents];

        // Apply class filter
        if (filterClass) {
            filtered = filtered.filter((s) => s.class === filterClass);
        }

        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (s) =>
                    s.user.name.toLowerCase().includes(query) ||
                    s.user.email.toLowerCase().includes(query) ||
                    s.id.toLowerCase().includes(query),
            );
        }

        // Calculate pagination
        totalPages = Math.ceil(filtered.length / limit);
        const start = (currentPage - 1) * limit;
        const end = start + limit;
        students = filtered.slice(start, end);
    }

    function clearFilters() {
        filterClass = "";
        searchQuery = "";
        currentPage = 1;
        applyFiltersAndPagination();
    }

    function goToPage(page) {
        if (page >= 1 && page <= totalPages) {
            currentPage = page;
            applyFiltersAndPagination();
        }
    }

    function nextPage() {
        if (currentPage < totalPages) {
            currentPage++;
            applyFiltersAndPagination();
        }
    }

    function prevPage() {
        if (currentPage > 1) {
            currentPage--;
            applyFiltersAndPagination();
        }
    }

    function openModal(student = null) {
        if (student) {
            editingId = student.id;
            form = {
                name: student.user.name,
                email: student.user.email,
                class: student.class,
                password: "",
            };
        } else {
            editingId = null;
            form = {
                name: "",
                email: "",
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
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${auth.getToken()}`,
                },
                body: JSON.stringify(form),
            });

            if (response.ok) {
                showModal = false;
                fetchStudents();
                alert(
                    editingId
                        ? "Student updated successfully!"
                        : "Student created successfully!",
                );
            } else {
                const data = await response.json();
                alert(data.error || "Failed to save student");
            }
        } catch (error) {
            alert("Error: " + error.message);
        }
    }

    async function deleteStudent(id) {
        if (!confirm("Are you sure you want to delete this student?")) return;

        try {
            const response = await fetch(`${API_URL}/students/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });

            if (response.ok) {
                fetchStudents();
                alert("Student deleted successfully!");
            } else {
                const data = await response.json();
                alert(data.error || "Failed to delete student");
            }
        } catch (error) {
            alert("Error: " + error.message);
        }
    }

    // Get unique classes for filter
    $: classes = [...new Set(allStudents.map((s) => s.class))];

    // Reactive: re-apply filters when filter values change
    $: if (filterClass || searchQuery) {
        currentPage = 1;
        applyFiltersAndPagination();
    }

    $: stats = {
        total: allStudents.length,
        byClass: classes.reduce((acc, cls) => {
            acc[cls] = allStudents.filter((s) => s.class === cls).length;
            return acc;
        }, {}),
    };
</script>

<Layout activePage="/students" title="Students Management">
    <div class="space-y-6">
        <!-- Header -->
        <div
            class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
            <div>
                <h2 class="text-2xl font-bold text-gray-900">
                    <i class="fas fa-users mr-2"></i>
                    Students
                </h2>
                <p class="text-sm text-gray-500 mt-1">
                    Total: {stats.total} students
                </p>
            </div>
            <button
                on:click={() => openModal()}
                class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2"
            >
                <i class="fas fa-plus"></i>
                <span>Add Student</span>
            </button>
        </div>

        <!-- Filters -->
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
                <i class="fas fa-filter mr-2"></i>
                Filters
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Search</label
                    >
                    <input
                        type="text"
                        bind:value={searchQuery}
                        placeholder="Search by name, email, or ID..."
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Class</label
                    >
                    <select
                        bind:value={filterClass}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    >
                        <option value="">All Classes</option>
                        {#each classes as cls}
                            <option value={cls}>{cls}</option>
                        {/each}
                    </select>
                </div>
            </div>

            {#if filterClass || searchQuery}
                <button
                    on:click={clearFilters}
                    class="mt-3 px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                >
                    <i class="fas fa-times mr-1"></i>
                    Clear Filters
                </button>
            {/if}
        </div>

        <!-- Students Table -->
        <div class="bg-white rounded-lg shadow overflow-x-auto">
            {#if loading}
                <div class="flex justify-center py-20">
                    <i class="fas fa-spinner fa-spin text-4xl text-primary-500"
                    ></i>
                </div>
            {:else if students.length === 0}
                <div class="text-center py-20 text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>No students found</p>
                </div>
            {:else}
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >ID</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Name</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Email</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Class</th
                            >
                            <th
                                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Attendance</th
                            >
                            <th
                                class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                                >Actions</th
                            >
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        {#each students as student}
                            <tr class="hover:bg-gray-50">
                                <td
                                    class="px-4 py-3 whitespace-nowrap text-sm text-gray-500"
                                >
                                    #{students.indexOf(student) +
                                        1 +
                                        (currentPage - 1) * limit}
                                </td>
                                <td
                                    class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900"
                                >
                                    {student.user.name}
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-500">
                                    {student.user.email}
                                </td>
                                <td
                                    class="px-4 py-3 whitespace-nowrap text-sm text-gray-500"
                                >
                                    <span
                                        class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800"
                                    >
                                        {student.class}
                                    </span>
                                </td>
                                <td
                                    class="px-4 py-3 whitespace-nowrap text-sm text-gray-500"
                                >
                                    {student._count?.attendances || 0} records
                                </td>
                                <td
                                    class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2"
                                >
                                    <button
                                        on:click={() => openModal(student)}
                                        class="text-blue-600 hover:text-blue-900"
                                        title="Edit"
                                    >
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button
                                        on:click={() =>
                                            deleteStudent(student.id)}
                                        class="text-red-600 hover:text-red-900"
                                        title="Delete"
                                    >
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>

                <!-- Pagination -->
                {#if totalPages > 1}
                    <div
                        class="px-6 py-4 border-t border-gray-200 flex items-center justify-between"
                    >
                        <div class="text-sm text-gray-700">
                            Showing <span class="font-medium"
                                >{(currentPage - 1) * limit + 1}</span
                            >
                            to
                            <span class="font-medium"
                                >{Math.min(
                                    currentPage * limit,
                                    allStudents.length,
                                )}</span
                            >
                            of
                            <span class="font-medium">{allStudents.length}</span
                            > students
                        </div>

                        <div class="flex items-center gap-2">
                            <button
                                on:click={prevPage}
                                disabled={currentPage === 1}
                                class="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                                <i class="fas fa-chevron-left"></i>
                            </button>

                            {#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
                                {#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
                                    <button
                                        on:click={() => goToPage(page)}
                                        class="px-3 py-1 border rounded-lg text-sm {page ===
                                        currentPage
                                            ? 'bg-primary-600 text-white border-primary-600'
                                            : 'border-gray-300 hover:bg-gray-50'}"
                                    >
                                        {page}
                                    </button>
                                {:else if page === currentPage - 2 || page === currentPage + 2}
                                    <span class="px-2 text-gray-500">...</span>
                                {/if}
                            {/each}

                            <button
                                on:click={nextPage}
                                disabled={currentPage === totalPages}
                                class="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                {/if}
            {/if}
        </div>
    </div>
</Layout>

<!-- Add/Edit Student Modal -->
{#if showModal}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
        <div class="bg-white rounded-lg max-w-md w-full p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-4">
                {editingId ? "Edit Student" : "Add Student"}
            </h3>

            <form on:submit|preventDefault={handleSubmit} class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Name</label
                    >
                    <input
                        type="text"
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
                        >Class</label
                    >
                    <input
                        type="text"
                        bind:value={form.class}
                        required
                        placeholder="e.g., 12"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >Password {editingId ? "(optional)" : ""}</label
                    >
                    <input
                        type="password"
                        bind:value={form.password}
                        required={!editingId}
                        placeholder={editingId
                            ? "Leave empty to keep current"
                            : ""}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                    {#if !editingId}
                        <p class="text-xs text-gray-500 mt-1">
                            Default: student[email prefix]
                        </p>
                    {/if}
                </div>

                <div class="flex gap-3 justify-end">
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
                        {editingId ? "Update" : "Create"}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}
