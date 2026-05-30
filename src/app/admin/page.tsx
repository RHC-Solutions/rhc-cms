import { redirect } from 'next/navigation';

export default function AdminIndexRedirect() {
  // Redirect admin index to the dashboard
  redirect('/admin/dashboard');
}
