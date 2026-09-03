// SEO Fallback: <title>SMA | Dashboard</title> name="description" og:
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import AuthGuard from "@/components/auth/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div
          className="flex flex-col flex-1 overflow-hidden transition-all duration-300 min-w-0"
        >
          <Header />
          <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-8">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
