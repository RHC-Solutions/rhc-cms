import { redirect } from 'next/navigation';

// This is the standalone admin app — the root simply forwards to the dashboard.
export default function Home() {
  redirect('/admin/dashboard');
}
