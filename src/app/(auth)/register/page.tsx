import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Criar Conta — Vitaliano ERP",
};

export default function RegisterPage() {
  return (
    <div className="rounded-xl bg-white p-8 shadow-lg">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Criar Conta</h1>
        <p className="mt-1 text-sm text-slate-500">
          Crie sua conta no Vitaliano ERP
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
