import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Redefinir Senha — Vitaliano ERP",
};

export default function ResetPasswordPage() {
  return (
    <div className="rounded-xl bg-white p-8 shadow-lg">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Redefinir Senha</h1>
        <p className="mt-1 text-sm text-slate-500">
          Informe seu e-mail para receber o link de redefinição
        </p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
