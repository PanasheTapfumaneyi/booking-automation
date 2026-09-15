import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardLoading from "@/components/dashboard/DashboardLoading";

export default function StorefrontLoadingPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <DashboardLoading />
      </main>
      <Footer />
    </>
  );
}
