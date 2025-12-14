<script>
  import { onMount } from 'svelte';
  
  const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3000/api';
  
  let users = [];
  let loading = true;
  let error = null;
  let formData = { name: '', email: '' };
  let editingId = null;
  let submitting = false;
  
  onMount(() => {
    fetchUsers();
  });
  
  async function fetchUsers() {
    loading = true;
    error = null;
    
    try {
      const response = await fetch(`${API_URL}/users`);
      if (!response.ok) throw new Error('Failed to fetch users');
      users = await response.json();
    } catch (err) {
      error = err.message;
      console.error('Error:', err);
    } finally {
      loading = false;
    }
  }
  
  async function handleSubmit() {
    if (!formData.name || !formData.email) {
      alert('Please fill in all fields');
      return;
    }
    
    submitting = true;
    error = null;
    
    try {
      const url = editingId 
        ? `${API_URL}/users/${editingId}`
        : `${API_URL}/users`;
      
      const method = editingId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save user');
      }
      
      await fetchUsers();
      resetForm();
    } catch (err) {
      error = err.message;
      console.error('Error:', err);
    } finally {
      submitting = false;
    }
  }
  
  async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    error = null;
    
    try {
      const response = await fetch(`${API_URL}/users/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete user');
      
      await fetchUsers();
    } catch (err) {
      error = err.message;
      console.error('Error:', err);
    }
  }
  
  function editUser(user) {
    formData = { name: user.name, email: user.email };
    editingId = user.id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  function resetForm() {
    formData = { name: '', email: '' };
    editingId = null;
  }
  
  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<main class="container">
  <div class="header">
    <h1 class="title">
      <span class="gradient-text">User Management</span>
    </h1>
    <p class="subtitle">Manage your users with a beautiful interface</p>
  </div>
  
  {#if error}
    <div class="alert alert-error">
      <span class="alert-icon">⚠️</span>
      <span>{error}</span>
      <button class="alert-close" on:click={() => error = null}>×</button>
    </div>
  {/if}
  
  <div class="card form-card">
    <h2 class="card-title">
      {editingId ? '✏️ Edit User' : '➕ Add New User'}
    </h2>
    
    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-group">
        <label for="name">Name</label>
        <input
          type="text"
          id="name"
          bind:value={formData.name}
          placeholder="Enter name"
          disabled={submitting}
          required
        />
      </div>
      
      <div class="form-group">
        <label for="email">Email</label>
        <input
          type="email"
          id="email"
          bind:value={formData.email}
          placeholder="Enter email"
          disabled={submitting}
          required
        />
      </div>
      
      <div class="form-actions">
        <button type="submit" class="btn btn-primary" disabled={submitting}>
          {#if submitting}
            <span class="spinner"></span>
            Saving...
          {:else}
            {editingId ? 'Update User' : 'Add User'}
          {/if}
        </button>
        
        {#if editingId}
          <button type="button" class="btn btn-secondary" on:click={resetForm} disabled={submitting}>
            Cancel
          </button>
        {/if}
      </div>
    </form>
  </div>
  
  <div class="card users-card">
    <div class="card-header">
      <h2 class="card-title">👥 Users List</h2>
      <button class="btn btn-outline btn-sm" on:click={fetchUsers} disabled={loading}>
        {#if loading}
          <span class="spinner"></span>
        {:else}
          🔄 Refresh
        {/if}
      </button>
    </div>
    
    {#if loading}
      <div class="loading-state">
        <div class="spinner-large"></div>
        <p>Loading users...</p>
      </div>
    {:else if users.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>No users yet</h3>
        <p>Add your first user to get started!</p>
      </div>
    {:else}
      <div class="users-grid">
        {#each users as user, i (user.id)}
          <div class="user-card" style="animation-delay: {i * 50}ms">
            <div class="user-avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div class="user-info">
              <h3 class="user-name">{user.name}</h3>
              <p class="user-email">{user.email}</p>
              <p class="user-date">Joined {formatDate(user.createdAt)}</p>
            </div>
            <div class="user-actions">
              <button 
                class="btn-icon btn-edit" 
                on:click={() => editUser(user)}
                title="Edit user"
              >
                ✏️
              </button>
              <button 
                class="btn-icon btn-delete" 
                on:click={() => deleteUser(user.id)}
                title="Delete user"
              >
                🗑️
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</main>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    animation: fadeIn 0.6s ease-out;
  }
  
  .header {
    text-align: center;
    margin-bottom: var(--spacing-2xl);
  }
  
  .title {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    margin-bottom: var(--spacing-sm);
  }
  
  .gradient-text {
    background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .subtitle {
    color: var(--color-text-secondary);
    font-size: var(--font-size-lg);
  }
  
  .card {
    background: var(--color-bg-card);
    backdrop-filter: blur(10px);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--spacing-xl);
    margin-bottom: var(--spacing-xl);
    box-shadow: var(--shadow-md);
    transition: all var(--transition-base);
  }
  
  .card:hover {
    border-color: var(--color-border-hover);
    box-shadow: var(--shadow-lg), var(--shadow-glow);
  }
  
  .card-title {
    font-size: var(--font-size-xl);
    font-weight: 600;
    margin-bottom: var(--spacing-lg);
    color: var(--color-text-primary);
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
  }
  
  .card-header .card-title {
    margin-bottom: 0;
  }
  
  .alert {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-lg);
    animation: slideIn 0.3s ease-out;
  }
  
  .alert-error {
    background: hsla(0, 80%, 60%, 0.1);
    border: 1px solid var(--color-danger);
    color: var(--color-danger);
  }
  
  .alert-icon {
    font-size: var(--font-size-xl);
  }
  
  .alert-close {
    margin-left: auto;
    background: none;
    border: none;
    color: inherit;
    font-size: var(--font-size-2xl);
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all var(--transition-fast);
  }
  
  .alert-close:hover {
    background: hsla(0, 0%, 100%, 0.1);
  }
  
  .form-group {
    margin-bottom: var(--spacing-lg);
  }
  
  label {
    display: block;
    margin-bottom: var(--spacing-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  input {
    width: 100%;
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-size: var(--font-size-base);
    font-family: inherit;
    transition: all var(--transition-base);
  }
  
  input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px hsla(260, 85%, 60%, 0.1);
  }
  
  input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .form-actions {
    display: flex;
    gap: var(--spacing-md);
    margin-top: var(--spacing-xl);
  }
  
  .btn {
    padding: var(--spacing-md) var(--spacing-xl);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-base);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    font-family: inherit;
  }
  
  .btn-primary {
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
    color: white;
    box-shadow: var(--shadow-sm);
  }
  
  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md), 0 0 20px hsla(260, 85%, 60%, 0.4);
  }
  
  .btn-primary:active:not(:disabled) {
    transform: translateY(0);
  }
  
  .btn-secondary {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: var(--color-bg-secondary);
    border-color: var(--color-border-hover);
  }
  
  .btn-outline {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
  }
  
  .btn-outline:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    border-color: var(--color-primary);
  }
  
  .btn-sm {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--font-size-sm);
  }
  
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  
  .spinner-large {
    width: 48px;
    height: 48px;
    border: 4px solid var(--color-bg-tertiary);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl);
    gap: var(--spacing-lg);
    color: var(--color-text-secondary);
  }
  
  .empty-state {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--color-text-secondary);
  }
  
  .empty-icon {
    font-size: 4rem;
    margin-bottom: var(--spacing-lg);
  }
  
  .empty-state h3 {
    font-size: var(--font-size-xl);
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-sm);
  }
  
  .users-grid {
    display: grid;
    gap: var(--spacing-lg);
  }
  
  .user-card {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--spacing-lg);
    align-items: center;
    padding: var(--spacing-lg);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    transition: all var(--transition-base);
    animation: slideIn 0.4s ease-out both;
  }
  
  .user-card:hover {
    background: var(--color-bg-secondary);
    border-color: var(--color-border-hover);
    transform: translateX(4px);
  }
  
  .user-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: white;
    box-shadow: var(--shadow-sm);
  }
  
  .user-info {
    min-width: 0;
  }
  
  .user-name {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-xs);
  }
  
  .user-email {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: var(--spacing-xs);
    word-break: break-word;
  }
  
  .user-date {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }
  
  .user-actions {
    display: flex;
    gap: var(--spacing-sm);
  }
  
  .btn-icon {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-lg);
    cursor: pointer;
    transition: all var(--transition-base);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
  }
  
  .btn-edit:hover {
    background: hsla(200, 90%, 55%, 0.1);
    border-color: var(--color-secondary);
    transform: scale(1.1);
  }
  
  .btn-delete:hover {
    background: hsla(0, 80%, 60%, 0.1);
    border-color: var(--color-danger);
    transform: scale(1.1);
  }
  
  @media (max-width: 768px) {
    .user-card {
      grid-template-columns: auto 1fr;
      gap: var(--spacing-md);
    }
    
    .user-actions {
      grid-column: 2;
      justify-self: end;
    }
    
    .form-actions {
      flex-direction: column;
    }
    
    .btn {
      width: 100%;
    }
  }
</style>
