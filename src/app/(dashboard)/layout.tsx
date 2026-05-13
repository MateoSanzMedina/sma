import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div
        className="flex flex-col flex-1 overflow-hidden transition-all duration-300 min-w-0"
      >
        <Header />
        <main className="flex-1 overflow-y-auto px-12 md:px-20 lg:px-24 xl:px-32 py-10">{children}</main>
      </div>
    </div>
  );
}

