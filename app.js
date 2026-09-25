// ==========================================================================
// MindCare Clinic - Core Application Logic
// ==========================================================================

// State Management
let currentUser = null;
let supabaseClient = null;
let isAdmin = false;

let appointments = [];
let adminAppointments = [];
let currentTab = 'upcoming';

// Initialize App on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Setup date picker minimum date to today
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('bookDate');
  if (dateInput) {
    dateInput.min = today;
    dateInput.value = today;
  }

  // Populate doctor dropdown
  populateDoctorDropdown();

  // Render initial doctor grids
  renderDoctorsGrid(PSYCHIATRISTS_DATA, 'allDoctorsGrid');
  renderDoctorsGrid(PSYCHIATRISTS_DATA.slice(0, 3), 'homeDoctorsGrid');

  // Update Auth and Dashboard state
  updateAuthUI();
  initializeSupabaseAuth();

  // Render Appointments
  renderAppointments();

  // If user is logged in, auto-fill booking form
  autofillBookingPatientInfo();

  // Close the profile modal on Escape or overlay click
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDoctorProfileModal();
  });
  const profileModal = document.getElementById('doctorProfileModal');
  if (profileModal) {
    profileModal.addEventListener('click', (e) => {
      if (e.target === profileModal) closeDoctorProfileModal();
    });
  }
});

// ==========================================================================
// Navigation & Page Switching
// ==========================================================================
function navigateTo(pageId) {
  const pages = document.querySelectorAll('.page-view');
  pages.forEach(p => p.style.display = 'none');

  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Update Nav Links Active Class
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.classList.remove('active');
    const onclickAttr = link.getAttribute('onclick');
    if (onclickAttr && onclickAttr.includes(`'${pageId}'`)) {
      link.classList.add('active');
    }
  });

  // Close mobile nav if open
  const navMenu = document.getElementById('navMenu');
  if (navMenu) {
    navMenu.classList.remove('show');
  }

  // Page specific hooks
  if (pageId === 'appointments') {
    renderAppointments();
  } else if (pageId === 'admin') {
    loadAdminAppointments();
  } else if (pageId === 'book') {
    autofillBookingPatientInfo();
  }
}

function toggleMobileMenu() {
  const navMenu = document.getElementById('navMenu');
  if (navMenu) {
    navMenu.classList.toggle('show');
  }
}

// ==========================================================================
// Doctor Directory Rendering & Search
// ==========================================================================
function renderDoctorsGrid(doctors, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (doctors.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--white); border-radius: var(--radius); border: 1px solid var(--slate-300);">
        <p style="font-weight: 700; color: var(--dark); font-size: 1.1rem;">No psychiatrists found</p>
        <p style="color: var(--slate-500); font-size: 0.9rem;">Try adjusting your search terms.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = doctors.map(doc => renderDoctorCard(doc)).join('');
}

function renderDoctorCard(doc) {
  const isPremium = !!doc.isPremium;

  const premiumRibbon = isPremium ? `
    <div class="premium-ribbon">
      <span aria-hidden="true">&#9733;</span>
      <span>${doc.premiumBadge || 'Premium Psychiatrist'}</span>
    </div>
  ` : '';

  return `
    <div class="doctor-card ${isPremium ? 'premium-card' : ''}">
      <div class="doctor-img-wrap">
        <img src="${doc.photo}" alt="${doc.name}" loading="lazy">
        ${premiumRibbon}
        <div class="doctor-fee-badge">${doc.fee} / session</div>
      </div>
      <div class="doctor-body">
        <div class="doctor-head">
          <div>
            <h3 class="doctor-name">${doc.name}</h3>
            <p class="doctor-spec">${doc.specialization}</p>
          </div>
          <span class="badge badge-success" style="font-size: 0.75rem; flex-shrink: 0;">
            &#9733; ${doc.rating} (${doc.reviews})
          </span>
        </div>

        <div class="doctor-meta">
          <div class="doctor-meta-item">
            <span>&#128188;</span> <span>${doc.experience}</span>
          </div>
          <div class="doctor-meta-item">
            <span>&#9200;</span> <span>${doc.timings}</span>
          </div>
          <div class="doctor-meta-item">
            <span>&#128205;</span> <span>${doc.location}</span>
          </div>
        </div>

        <p class="doctor-bio">${doc.bio}</p>

        <div class="doctor-footer">
          <button class="btn btn-secondary btn-sm" onclick="openDoctorProfileModal('${doc.id}')">
            View Profile
          </button>
          <button class="btn ${isPremium ? 'btn-premium' : 'btn-primary'} btn-sm" onclick="startBookingWithDoctor('${doc.id}')">
            Book Appointment
          </button>
        </div>
      </div>
    </div>
  `;
}

// ==========================================================================
// Doctor Profile Modal
// ==========================================================================
function openDoctorProfileModal(doctorId) {
  const doctor = PSYCHIATRISTS_DATA.find(d => d.id === doctorId);
  const modal = document.getElementById('doctorProfileModal');
  if (!doctor || !modal) return;

  const photo = document.getElementById('modalDocPhoto');
  photo.src = doctor.photo;
  photo.alt = doctor.name;

  document.getElementById('modalDocBadgeContainer').innerHTML = doctor.isPremium
    ? `<span class="badge-premium"><span aria-hidden="true">&#9733;</span><span>${doctor.premiumBadge || 'Premium Psychiatrist'}</span></span>`
    : '';
  document.getElementById('modalDocName').textContent = doctor.name;
  document.getElementById('modalDocSpec').textContent = doctor.specialization;
  document.getElementById('modalDocQual').textContent = doctor.qualification;
  document.getElementById('modalDocExp').textContent = doctor.experience;
  document.getElementById('modalDocTimings').textContent = doctor.timings;
  document.getElementById('modalDocLoc').textContent = doctor.location;
  document.getElementById('modalDocFee').textContent = `${doctor.fee} / session`;
  document.getElementById('modalDocBio').textContent = doctor.fullBio || doctor.bio;

  const bookBtn = document.getElementById('modalBookBtn');
  bookBtn.onclick = () => {
    closeDoctorProfileModal();
    startBookingWithDoctor(doctor.id);
  };

  modal.classList.add('active');
}

function closeDoctorProfileModal() {
  const modal = document.getElementById('doctorProfileModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function handleDoctorSearch(query) {
  const q = query.toLowerCase().trim();
  const filtered = PSYCHIATRISTS_DATA.filter(doc => 
    doc.name.toLowerCase().includes(q) ||
    doc.specialization.toLowerCase().includes(q) ||
    doc.bio.toLowerCase().includes(q)
  );
  renderDoctorsGrid(filtered, 'allDoctorsGrid');
}

// ==========================================================================
// Booking Appointment Logic
// ==========================================================================
function populateDoctorDropdown() {
  const select = document.getElementById('bookDoctorSelect');
  if (!select) return;

  select.innerHTML = '<option value="">-- Choose a Psychiatrist --</option>' + 
    PSYCHIATRISTS_DATA.map(doc => `
      <option value="${doc.id}">${doc.name} (${doc.specialization})</option>
    `).join('');
}

function startBookingWithDoctor(doctorId) {
  navigateTo('book');
  const select = document.getElementById('bookDoctorSelect');
  if (select) {
    select.value = doctorId;
    handleDoctorSelectChange(doctorId);
  }
}

function handleDoctorSelectChange(doctorId) {
  const slotsContainer = document.getElementById('slotsContainer');
  const slotInput = document.getElementById('selectedTimeSlot');
  slotInput.value = '';

  if (!doctorId) {
    slotsContainer.innerHTML = '<div style="font-size: 0.8rem; color: var(--slate-500); grid-column: 1 / -1;">Please select a psychiatrist first.</div>';
    return;
  }

  const doctor = PSYCHIATRISTS_DATA.find(d => d.id === doctorId);
  if (!doctor || !doctor.availableSlots) return;

  slotsContainer.innerHTML = doctor.availableSlots.map((slot, index) => `
    <button type="button" class="slot-btn ${index === 0 ? 'selected' : ''}" onclick="selectTimeSlot(this, '${slot}')">
      ${slot}
    </button>
  `).join('');

  // Default select first slot
  if (doctor.availableSlots.length > 0) {
    slotInput.value = doctor.availableSlots[0];
  }
}

function selectTimeSlot(btn, time) {
  const allSlotBtns = document.querySelectorAll('.slot-btn');
  allSlotBtns.forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('selectedTimeSlot').value = time;
}

function handleDateChange(dateValue) {
  // Re-verify slot selection if necessary
}

function autofillBookingPatientInfo() {
  if (currentUser) {
    const nameInput = document.getElementById('patientName');
    const phoneInput = document.getElementById('patientPhone');
    const emailInput = document.getElementById('patientEmail');

    if (nameInput && !nameInput.value) nameInput.value = currentUser.name || '';
    if (phoneInput && !phoneInput.value) phoneInput.value = currentUser.phone || '';
    if (emailInput && !emailInput.value) emailInput.value = currentUser.email || '';
  }
}

async function handleAppointmentSubmit(event) {
  event.preventDefault();

  if (!currentUser || !supabaseClient) {
    showToast('Please sign in before booking an appointment.');
    navigateTo('auth');
    return;
  }

  const doctorId = document.getElementById('bookDoctorSelect').value;
  const doctor = PSYCHIATRISTS_DATA.find(d => d.id === doctorId);
  const date = document.getElementById('bookDate').value;
  const time = document.getElementById('selectedTimeSlot').value;
  const phone = document.getElementById('patientPhone').value.trim();
  const name = currentUser.name || document.getElementById('patientName').value.trim();
  const email = currentUser.email;
  const reason = document.getElementById('appointmentReason').value.trim() || 'General psychiatric consultation';
  
  const consultTypeRadio = document.querySelector('input[name="consultationType"]:checked');
  const consultationType = consultTypeRadio ? consultTypeRadio.value : 'Online Video';

  if (!doctorId || !doctor) {
    showToast('Please select a psychiatrist', 'error');
    return;
  }

  if (!time) {
    showToast('Please select an available time slot', 'error');
    return;
  }

  const bookingCode = `APT-${Date.now()}`;
  const { data, error } = await supabaseClient.from('appointments').insert({
    booking_code: bookingCode,
    user_id: currentUser.id,
    patient_name: name,
    patient_email: email,
    patient_phone: phone,
    doctor_id: doctor.id,
    doctor_name: doctor.name,
    doctor_specialty: doctor.specialization,
    appointment_date: date,
    appointment_time: time,
    consultation_type: consultationType,
    reason,
    status: 'Pending'
  }).select().single();

  if (error) {
    const tableMissing = error.code === 'PGRST205' || /could not find the table.*public\.appointments/i.test(error.message || '');
    showToast(tableMissing
      ? "Appointments table is missing. Run supabase-admin-setup.sql in Supabase SQL Editor. If already run, execute NOTIFY pgrst, 'reload schema'; then refresh this page."
      : error.message);
    return;
  }

  const newAppointment = mapAppointmentRecord(data);
  appointments.unshift(newAppointment);

  // Reset form
  event.target.reset();
  autofillBookingPatientInfo();

  // Show Confirmation Modal
  showConfirmationModal(newAppointment);
  showToast('Appointment successfully booked!');
}

function showConfirmationModal(apt) {
  const detailsBox = document.getElementById('confirmationDetails');
  if (detailsBox) {
    detailsBox.innerHTML = `
      <div><strong>Booking ID:</strong> <span style="color: var(--primary); font-weight: 700;">${escapeHTML(apt.bookingCode || apt.id)}</span></div>
      <div><strong>Psychiatrist:</strong> ${apt.doctorName}</div>
      <div><strong>Specialty:</strong> ${apt.doctorSpecialty}</div>
      <div><strong>Date & Time:</strong> ${apt.date} at ${apt.time}</div>
      <div><strong>Mode:</strong> ${apt.consultationType}</div>
      <div><strong>Patient Name:</strong> ${apt.patientName} (${apt.patientEmail})</div>
    `;
  }
  const modal = document.getElementById('confirmationModal');
  if (modal) {
    modal.classList.add('active');
  }
}

function closeConfirmationModal() {
  const modal = document.getElementById('confirmationModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// ==========================================================================
// My Appointments Rendering & Actions
// ==========================================================================
function switchAppointmentsTab(tab) {
  currentTab = tab;
  document.getElementById('tabUpcomingBtn').classList.toggle('active', tab === 'upcoming');
  document.getElementById('tabPreviousBtn').classList.toggle('active', tab === 'previous');
  renderAppointments();
}

function renderAppointments() {
  const container = document.getElementById('appointmentsList');
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = '<div class="form-card"><p>Sign in to view your appointments.</p><button class="btn btn-primary" onclick="navigateTo(\'auth\')">Patient Sign In</button></div>';
    document.getElementById('upcomingBadgeCount').textContent = '0';
    document.getElementById('previousBadgeCount').textContent = '0';
    return;
  }

  const upcoming = appointments.filter(a => ['Pending', 'Confirmed', 'Upcoming'].includes(a.status));
  const previous = appointments.filter(a => !['Pending', 'Confirmed', 'Upcoming'].includes(a.status));

  document.getElementById('upcomingBadgeCount').textContent = upcoming.length;
  document.getElementById('previousBadgeCount').textContent = previous.length;

  const listToShow = currentTab === 'upcoming' ? upcoming : previous;

  if (listToShow.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1.5rem; background: var(--white); border-radius: var(--radius); border: 1px solid var(--slate-300);">
        <p style="font-weight: 700; color: var(--dark); font-size: 1.1rem;">No ${currentTab} appointments found</p>
        <p style="color: var(--slate-500); font-size: 0.9rem; margin-bottom: 1.5rem;">
          ${currentTab === 'upcoming' ? "You don't have any appointments scheduled." : "You have no past consultation history."}
        </p>
        <button class="btn btn-primary" onclick="navigateTo('book')">
          Book an Appointment Now
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = listToShow.map(apt => `
    <div class="appointment-card">
      <div class="apt-doctor-info">
        <img src="${escapeHTML(apt.doctorPhoto)}" alt="${escapeHTML(apt.doctorName)}" class="apt-avatar">
        <div class="apt-details">
          <h4>${escapeHTML(apt.doctorName)}</h4>
          <p>${escapeHTML(apt.doctorSpecialty)}</p>
          <p style="margin-top: 0.35rem; font-size: 0.8rem; color: var(--slate-500);">
            <strong>Reason:</strong> ${escapeHTML(apt.reason)}
          </p>
        </div>
      </div>

      <div class="apt-time-badge">
        <div style="font-weight: 700; color: var(--dark); font-size: 0.95rem;">
          &#128197; ${escapeHTML(apt.date)}
        </div>
        <div style="color: var(--slate-700); font-size: 0.875rem;">
          &#9200; ${escapeHTML(apt.time)}
        </div>
        <div style="font-size: 0.8rem; color: var(--slate-500);">
          ${escapeHTML(apt.consultationType)}
        </div>
      </div>

      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
        <span class="badge ${['Pending', 'Confirmed', 'Upcoming'].includes(apt.status) ? 'badge-primary' : 'badge-secondary'}">
          ${escapeHTML(apt.status)}
        </span>
        <span style="font-size: 0.75rem; color: var(--slate-500);">ID: ${escapeHTML(apt.bookingCode || apt.id)}</span>
        
        ${['Pending', 'Confirmed', 'Upcoming'].includes(apt.status) ? `
          <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
            <button class="btn btn-sm btn-secondary" onclick="rescheduleAppointment('${apt.id}')">
              Reschedule
            </button>
            <button class="btn btn-sm btn-danger" onclick="cancelAppointment('${apt.id}')">
              Cancel
            </button>
          </div>
        ` : `
          <button class="btn btn-sm btn-outline-primary" onclick="startBookingWithDoctor('${apt.doctorId}')">
            Book Again
          </button>
        `}
      </div>
    </div>
  `).join('');
}

async function cancelAppointment(id) {
  if (confirm('Are you sure you want to cancel this appointment?')) {
    const { error } = await supabaseClient.from('appointments').update({ status: 'Cancelled' }).eq('id', id);
    if (error) {
      showToast(error.message);
      return;
    }
    appointments = appointments.map(apt => apt.id === id ? { ...apt, status: 'Cancelled' } : apt);
    renderAppointments();
    updateDashboardCounts();
    showToast('Appointment cancelled.');
  }
}

function rescheduleAppointment(id) {
  const apt = appointments.find(a => a.id === id);
  if (apt) {
    startBookingWithDoctor(apt.doctorId);
    showToast('Select a new date and time for your visit.');
  }
}

function mapAppointmentRecord(record) {
  const doctor = PSYCHIATRISTS_DATA.find(item => item.id === record.doctor_id);
  return {
    id: record.id,
    bookingCode: record.booking_code,
    doctorId: record.doctor_id,
    doctorName: record.doctor_name,
    doctorSpecialty: record.doctor_specialty,
    doctorPhoto: doctor?.photo || '',
    date: record.appointment_date,
    time: record.appointment_time,
    patientName: record.patient_name,
    patientEmail: record.patient_email,
    patientPhone: record.patient_phone,
    consultationType: record.consultation_type,
    reason: record.reason,
    status: record.status
  };
}

function escapeHTML(value) {
  const element = document.createElement('span');
  element.textContent = value ?? '';
  return element.innerHTML;
}

async function loadPatientAppointments(userId = currentUser?.id) {
  if (!userId || !supabaseClient) return;
  const { data, error } = await supabaseClient
    .from('appointments')
    .select('*')
    .eq('user_id', userId)
    .order('appointment_date', { ascending: true });

  if (currentUser?.id !== userId) return;
  if (error) {
    showToast(error.message);
    return;
  }

  appointments = data.map(mapAppointmentRecord);
  renderAppointments();
  updateDashboardCounts();
}

async function loadAdminAppointments() {
  const container = document.getElementById('adminAppointmentsList');
  if (!container) return;
  if (!isAdmin || !supabaseClient) {
    container.innerHTML = '<div class="form-card"><p>Administrator access is required to view patient appointments.</p></div>';
    return;
  }

  container.innerHTML = '<p>Loading appointments...</p>';
  const { data, error } = await supabaseClient
    .from('appointments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.textContent = `Unable to load appointments: ${error.message}`;
    return;
  }

  adminAppointments = data.map(mapAppointmentRecord);
  renderAdminAppointments();
}

function renderAdminAppointments() {
  const container = document.getElementById('adminAppointmentsList');
  if (!container) return;

  const statusFilter = document.getElementById('adminStatusFilter')?.value || 'All';
  const query = (document.getElementById('adminSearch')?.value || '').trim().toLowerCase();
  const filtered = adminAppointments.filter(apt => {
    const matchesStatus = statusFilter === 'All' || apt.status === statusFilter;
    const matchesQuery = !query || [apt.patientName, apt.patientEmail, apt.patientPhone, apt.bookingCode]
      .some(value => String(value || '').toLowerCase().includes(query));
    return matchesStatus && matchesQuery;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="form-card"><p>No appointments match this filter.</p></div>';
    return;
  }

  container.innerHTML = filtered.map(apt => `
    <article class="appointment-card admin-appointment-card">
      <div class="apt-details admin-patient-details">
        <span class="badge badge-secondary">${escapeHTML(apt.bookingCode)}</span>
        <h3>${escapeHTML(apt.patientName)}</h3>
        <p><a href="mailto:${encodeURIComponent(apt.patientEmail)}">${escapeHTML(apt.patientEmail)}</a></p>
        <p><a href="tel:${encodeURIComponent(apt.patientPhone)}">${escapeHTML(apt.patientPhone)}</a></p>
        <p><strong>Reason:</strong> ${escapeHTML(apt.reason)}</p>
      </div>
      <div class="apt-details">
        <h4>${escapeHTML(apt.doctorName)}</h4>
        <p>${escapeHTML(apt.doctorSpecialty)}</p>
        <p>${escapeHTML(apt.date)} at ${escapeHTML(apt.time)}</p>
        <p>${escapeHTML(apt.consultationType)}</p>
      </div>
      <div class="admin-appointment-actions">
        <span class="badge ${apt.status === 'Confirmed' ? 'badge-success' : apt.status === 'Pending' ? 'badge-primary' : 'badge-secondary'}">${escapeHTML(apt.status)}</span>
        ${apt.status !== 'Cancelled' && apt.status !== 'Completed' ? `
          <button class="btn btn-sm btn-primary" onclick="setAppointmentStatus('${apt.id}', 'Confirmed')">Confirm</button>
          <button class="btn btn-sm btn-danger" onclick="setAppointmentStatus('${apt.id}', 'Cancelled')">Cancel</button>
        ` : ''}
      </div>
    </article>
  `).join('');
}

async function setAppointmentStatus(id, status) {
  if (!isAdmin || !['Confirmed', 'Cancelled'].includes(status)) return;
  const { error } = await supabaseClient
    .from('appointments')
    .update({ status })
    .eq('id', id);

  if (error) {
    showToast(error.message);
    return;
  }

  adminAppointments = adminAppointments.map(apt => apt.id === id ? { ...apt, status } : apt);
  appointments = appointments.map(apt => apt.id === id ? { ...apt, status } : apt);
  renderAdminAppointments();
  renderAppointments();
  updateDashboardCounts();
  showToast(`Appointment ${status.toLowerCase()}.`);
}

// ==========================================================================
// Authentication & Patient Portal
// ==========================================================================
const SUPABASE_URL = 'https://aiclsmevqqsamlkjpsic.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BN_M7MJjMFkbq3fZRJ-Iew_kqBOWuwR';

async function initializeSupabaseAuth() {
  if (!window.supabase) {
    showToast('Unable to load patient sign-in. Please refresh and try again.');
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    showToast(error.message);
    return;
  }

  await syncAuthenticatedUser(data.session?.user ?? null);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => syncAuthenticatedUser(session?.user ?? null), 0);
  });
}

async function syncAuthenticatedUser(user) {
  currentUser = user ? {
    id: user.id,
    name: user.user_metadata?.full_name || user.email.split('@')[0],
    email: user.email,
    phone: user.user_metadata?.phone || ''
  } : null;

  if (!currentUser) {
    isAdmin = false;
    appointments = [];
    adminAppointments = [];
    updateAuthUI();
    renderAppointments();
    updateDashboardCounts();
    return;
  }

  const userId = currentUser.id;
  await Promise.all([loadPatientAppointments(userId), loadAdminAccess(userId)]);
  if (currentUser?.id !== userId) return;
  updateAuthUI();
  if (currentUser) autofillBookingPatientInfo();
}

async function loadAdminAccess(userId) {
  const { data, error } = await supabaseClient
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (currentUser?.id !== userId) return;
  isAdmin = !error && !!data;
  if (error) showToast('Admin access is not configured yet. Run the Supabase setup SQL.');
}

function switchAuthTab(tab) {
  document.getElementById('tabLoginBtn').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegisterBtn').classList.toggle('active', tab === 'register');
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  if (!supabaseClient) {
    showToast('Patient sign-in is not available. Please refresh and try again.');
    return;
  }

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(error.message);
    return;
  }

  showToast('Signed in successfully. Welcome back!');
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  if (!supabaseClient) {
    showToast('Patient registration is not available. Please refresh and try again.');
    return;
  }

  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } }
  });
  if (error) {
    showToast(error.message);
    return;
  }

  if (data.session) {
    showToast(`Account created. Welcome, ${name}.`);
  } else {
    showToast('Account created. Check your email to confirm your address.');
  }
}

async function handleLogout() {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showToast(error.message);
    return;
  }
  showToast('You have signed out.');
}

function updateAuthUI() {
  const navContainer = document.getElementById('authNavContainer');
  const formsContainer = document.getElementById('authFormsContainer');
  const dashboardContainer = document.getElementById('patientDashboardContainer');

  if (currentUser) {
    if (navContainer) {
      navContainer.innerHTML = `
        ${isAdmin ? '<button class="btn btn-secondary btn-sm" onclick="navigateTo(\'admin\')">Admin</button>' : ''}
        <button class="btn btn-secondary btn-sm" onclick="navigateTo('auth')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>${escapeHTML(currentUser.name.split(' ')[0])}</span>
        </button>
      `;
    }
    if (formsContainer) formsContainer.style.display = 'none';
    if (dashboardContainer) {
      dashboardContainer.style.display = 'block';
      document.getElementById('dashPatientName').textContent = currentUser.name;
      document.getElementById('dashPatientEmail').textContent = currentUser.email;
      updateDashboardCounts();
    }
  } else {
    if (navContainer) {
      navContainer.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="navigateTo('auth')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Login / Signup</span>
        </button>
      `;
    }
    if (formsContainer) formsContainer.style.display = 'block';
    if (dashboardContainer) dashboardContainer.style.display = 'none';
  }
}

function updateDashboardCounts() {
  const upcoming = appointments.filter(a => a.status === 'Upcoming').length;
  const past = appointments.filter(a => a.status !== 'Upcoming').length;
  
  const upEl = document.getElementById('dashUpcomingCount');
  const pastEl = document.getElementById('dashPastCount');
  if (upEl) upEl.textContent = upcoming;
  if (pastEl) pastEl.textContent = past;
}

// ==========================================================================
// Contact Form & Toast
// ==========================================================================
function handleContactSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('contactName').value;
  event.target.reset();
  showToast(`Thank you, ${name}! Your message has been sent to our care team.`);
}

let toastTimeout;
function showToast(message) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMessage');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}
