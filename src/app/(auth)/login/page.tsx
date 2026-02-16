import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login — Vitaliano ERP",
};

export default function LoginPage() {
  return (
    <div className="rounded-xl bg-white p-8 shadow-lg">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Vitaliano ERP</h1>
        <p className="mt-1 text-sm text-slate-500">
          Acesse sua conta para continuar
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
