import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

const proxy = authkitMiddleware();
export { proxy };

// Run on all routes except static assets so withAuth() works in pages and API routes
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico|jpg|jpeg|gif|webp)$).*)"],
};
