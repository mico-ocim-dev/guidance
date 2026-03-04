import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="card">
        <p className="text-sm text-gray-600 mb-4">
          Create a <strong>user</strong> account only. Admin and staff accounts are managed by the office.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
