import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSessionCookie, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';

// Gates everything under /admin and /api/admin except the login page/route
// itself. This is the ONLY thing standing between the public internet and
// the admin dashboard, so it fails closed: no cookie or a bad cookie means
// no access, full stop.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isLoginPage = pathname === '/admin/login';
  const isLoginApi = pathname === '/api/admin/login';
  const isAdminPath = pathname.startsWith('/admin') && !isLoginPage;
  const isAdminApi = pathname.startsWith('/api/admin') && !isLoginApi;

  if (isAdminPath || isAdminApi) {
    const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!verifyAdminSessionCookie(cookie)) {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const loginUrl = new URL('/admin/login', req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
