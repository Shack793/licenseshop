'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/admin/login';

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  if (isLogin) return <>{children}</>;

  const links = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/releases', label: 'Releases' },
    { href: '/admin/licenses', label: 'Licenses' },
    { href: '/admin/payments', label: 'Payments' },
  ];

  return (
    <div>
      <nav className="admin-nav">
        <div className="wordmark">
          <span className="suit">♠</span> Shoepilot Pro admin
        </div>
        <div className="admin-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
              {l.label}
            </Link>
          ))}
          <a onClick={handleLogout}>Log out</a>
        </div>
      </nav>
      {children}
    </div>
  );
}
