<script>
  import { onMount } from "svelte";
  import Router from "svelte-spa-router";
  import { auth } from "./stores/auth.js";

  // Import pages
  import Login from "./pages/Login.svelte";
  import AdminDashboard from "./pages/admin/Dashboard.svelte";
  import AdminSchedules from "./pages/admin/Schedules.svelte";
  import AdminStudents from "./pages/admin/Students.svelte";
  import AdminHistory from "./pages/admin/History.svelte";
  import AdminPayments from "./pages/admin/Payments.svelte";
  import StudentScanQR from "./pages/student/ScanQR.svelte";
  import StudentAttendance from "./pages/student/Attendance.svelte";
  import StudentPayment from "./pages/student/Payment.svelte";
  import Profile from "./pages/Profile.svelte";

  onMount(() => {
    auth.init();
  });

  // Define routes
  $: routes = $auth.user
    ? $auth.user.role === "ADMIN"
      ? {
          "/": AdminDashboard,
          "/schedules": AdminSchedules,
          "/students": AdminStudents,
          "/history": AdminHistory,
          "/payments": AdminPayments,
          "/profile": Profile,
        }
      : {
          "/": StudentScanQR,
          "/attendance": StudentAttendance,
          "/payment": StudentPayment,
          "/profile": Profile,
        }
    : {
        "/": Login,
        "/login": Login,
        "*": Login,
      };

  // Route guard
  function conditionsFailed(event) {
    if (
      !$auth.user &&
      event.detail.location !== "/login" &&
      event.detail.location !== "/"
    ) {
      event.preventDefault();
      window.location.hash = "#/login";
    }
  }
</script>

<svelte:head>
  <title>Pay & Attend</title>
</svelte:head>

{#if $auth.loading}
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
      <i class="fas fa-spinner fa-spin text-4xl text-primary-600 mb-4"></i>
      <p class="text-gray-600">Loading...</p>
    </div>
  </div>
{:else}
  <Router {routes} on:conditionsFailed={conditionsFailed} />
{/if}
