'use client';

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth, useFirestore } from "@/firebase";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(""); setSuccess("");
    const normalizedEmail = email.trim().toLowerCase();
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    if (!name.trim()) return setError("Indica tu nombre.");
    setBusy(true);
    let createdUser = false;
    try {
      const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      createdUser = true;
      const invitationRef = doc(db, "invitations", normalizedEmail);
      const invitationSnapshot = await getDoc(invitationRef);
      if (!invitationSnapshot.exists()) {
        await credential.user.delete();
        await signOut(auth);
        createdUser = false;
        throw new Error("No existe una invitación pendiente para este correo. Solicita acceso al administrador de tu concesionario.");
      }
      const invitation = invitationSnapshot.data();
      if (invitation.email !== normalizedEmail || invitation.status !== "pending" || !invitation.tenantId) {
        await credential.user.delete();
        await signOut(auth);
        createdUser = false;
        throw new Error("La invitación no es válida o ya ha sido utilizada. Contacta con el administrador.");
      }
      await updateProfile(credential.user, { displayName: name.trim() });
      await setDoc(doc(db, "users", credential.user.uid), {
        email: normalizedEmail,
        displayName: name.trim(),
        role: invitation.role || "operator",
        tenantId: invitation.tenantId,
        active: true,
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      });
      await updateDoc(invitationRef, {
        status: "accepted",
        acceptedAt: serverTimestamp(),
        acceptedBy: credential.user.uid,
      });
      setSuccess("Cuenta creada. Abriendo tu espacio de trabajo…");
      router.replace("/");
    } catch (e: any) {
      if (createdUser && auth.currentUser) {
        try { await auth.currentUser.delete(); } catch {}
        try { await signOut(auth); } catch {}
      }
      const code = String(e?.code || "");
      setError(e?.message?.startsWith("No existe") || e?.message?.startsWith("La invitación") ? e.message :
        code === "auth/email-already-in-use" ? "Ya existe una cuenta con este correo. Inicia sesión o solicita ayuda al administrador." :
        code === "auth/invalid-email" ? "El correo electrónico no tiene un formato válido." :
        code === "auth/weak-password" ? "La contraseña es demasiado débil." :
        "No se ha podido completar el registro. Comprueba que el correo tenga una invitación pendiente.");
    } finally { setBusy(false); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0066b3]">GENIUS · Momentum</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Activar invitación</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Crea tu cuenta con el correo al que se ha enviado la invitación de tu concesionario.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <div><label className="mb-1.5 block text-xs font-semibold text-slate-700">Nombre completo</label><input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name" className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-600"/></div>
          <div><label className="mb-1.5 block text-xs font-semibold text-slate-700">Correo de invitación</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-600"/></div>
          <div><label className="mb-1.5 block text-xs font-semibold text-slate-700">Contraseña (mínimo 8 caracteres)</label><div className="relative"><input required minLength={8} type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" className="w-full rounded-lg border border-slate-200 px-3 py-3 pr-11 text-sm outline-none focus:border-blue-600"/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-slate-400" aria-label="Mostrar u ocultar contraseña">{showPassword?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></div></div>
          <div><label className="mb-1.5 block text-xs font-semibold text-slate-700">Repetir contraseña</label><input required minLength={8} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-600"/></div>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center rounded-lg bg-[#0066b3] py-3 text-sm font-semibold text-white hover:bg-[#00549a] disabled:opacity-60">{busy?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Creando cuenta…</>:"Crear cuenta"}</button>
        </form>
        <button onClick={()=>router.push("/login")} className="mt-5 w-full text-center text-sm font-medium text-[#0066b3] hover:underline">Volver al inicio de sesión</button>
      </div>
    </main>
  );
}
