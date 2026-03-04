import Image from "next/image";
import { LoginForm } from "@/components/LoginForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto py-8">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden p-8">
        <div className="text-center mb-6">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden flex items-center justify-center shrink-0 ring-2 ring-white/30">
            <Image src="/img/lspu-logo.jpg" alt="LSPU" width={96} height={96} className="w-full h-full object-cover" />
          </div>
          <h2 className="text-2xl font-bold text-[#1E3A8A] mb-1">GCO System Management</h2>
          <p className="text-gray-600 mb-1">Guidance & Counseling Office</p>
          <p className="text-sm text-gray-500 mb-4">Laguna State Polytechnic University - Sta. Cruz</p>
          <div className="inline-block bg-[#FACC15] text-white px-4 py-2 rounded-lg font-medium text-sm mb-6 shadow">
            Integrity. Professionalism. Innovation.
          </div>
        </div>
        <LoginForm />
        <p className="mt-4 text-center text-sm text-gray-600">
          <Link href="/auth/register" className="text-[#1E3A8A] font-medium hover:underline">Register</Link>
          {" | "}
          <Link href="/appointments/book" className="text-[#1E3A8A] font-medium hover:underline">Book Appointment</Link>
          {" | "}
          <Link href="/document-requests/track" className="text-[#1E3A8A] font-medium hover:underline">Track Request</Link>
        </p>
      </div>
    </div>
  );
}
