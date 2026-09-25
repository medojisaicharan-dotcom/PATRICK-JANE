# Patient Appointment Admin Setup

The admin page can show patient name, email, phone, appointment details, and reason for visit. It never reads or stores patient passwords. Supabase Auth does not make passwords visible to administrators.

## Setup

1. Because an account password was shared in chat, reset it before using that account. Do not add passwords to this repository or SQL files.
2. Open the patient portal's Register New Patient form and create the account for `medojisaicharan@gmail.com` using a new password entered directly in the browser.
3. In the Supabase dashboard, open SQL Editor and run [`supabase-admin-setup.sql`](supabase-admin-setup.sql). The SQL creates the appointments table and row-level security policies, then grants admin access to the account with that email.
4. Sign in with the admin account. The Admin button opens the appointment review page.
5. Test by registering a separate patient, booking an appointment, then signing in as the admin and confirming or cancelling it.

The setup SQL must be run after the admin account exists. If the account is created later, rerun the SQL so its membership insert can take effect. Existing browser-only demo appointments are not migrated; the admin page shows appointments created after the shared Supabase table is set up.
