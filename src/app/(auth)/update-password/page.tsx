import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = {
  title: "Nova Senha — Vitaliano ERP",
};

export default function UpdatePasswordPage() {
  return (
    <div className="rounded-xl bg-white p-8 shadow-lg">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Nova Senha</h1>
        <p className="mt-1 text-sm text-slate-500">
          Defina sua nova senha abaixo
        </p>
      </div>
      <UpdatePasswordForm />
    </div>
  );
}
