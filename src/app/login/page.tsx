'use client';

import { useEffect, useState, FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useAuth } from "@/firebase";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ImagePlus, Video, X, Settings2, Loader2 } from "lucide-react";

type LoginMedia = { type: "image" | "video"; url: string };
const DEFAULT_MEDIA: LoginMedia = { type: "image", url: "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1800&q=85" };
const MEDIA_KEY = "genius-login-media-v1";

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [media, setMedia] = useState<LoginMedia>(DEFAULT_MEDIA);
  const [mediaUrl, setMediaUrl] = useState(DEFAULT_MEDIA.url);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [editingMedia, setEditingMedia] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("genius-login-email");
      if (savedEmail) setEmail(savedEmail);
      const savedMedia = localStorage.getItem(MEDIA_KEY);
      if (savedMedia) {
        const parsed = JSON.parse(savedMedia) as LoginMedia;
        if (parsed?.url && (parsed.type === "image" || parsed.type === "video")) {
          setMedia(parsed); setMediaUrl(parsed.url); setMediaType(parsed.type);
        }
      }
    } catch {}
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      // Las cuentas se autentican en Firebase y su acceso operativo se valida
      // contra el perfil activo del concesionario en AppShell.
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      if (rememberEmail) localStorage.setItem("genius-login-email", normalizedEmail);
      else localStorage.removeItem("genius-login-email");
      router.replace("/");
    } catch (e: any) {
      const code = String(e?.code || "");
      console.error("Error de inicio de sesión Firebase:", code, e?.message || e);
      setError(
        code === "auth/unauthorized-domain"
          ? "Este dominio de Vercel no está autorizado en Firebase. Añade el dominio exacto de esta web en Authentication > Configuración > Dominios autorizados, o accede desde el dominio principal autorizado."
          : code === "auth/operation-not-allowed"
            ? "El acceso por correo y contraseña no está habilitado en Firebase Authentication."
            : code === "auth/invalid-api-key" || code === "auth/api-key-not-valid"
              ? "La clave API de Firebase no es válida. Revisa las variables NEXT_PUBLIC_FIREBASE_* en Vercel."
              : code === "auth/network-request-failed"
                ? "No se ha podido conectar con Firebase. Comprueba la conexión y que el dominio de Vercel esté autorizado."
                : code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"
                  ? "No se ha podido validar la cuenta. Comprueba que el usuario administrador esté creado en Firebase Authentication y que la contraseña sea correcta."
                  : code === "auth/too-many-requests"
                    ? "Demasiados intentos. Espera unos minutos y vuelve a intentarlo."
                    : code === "auth/configuration-not-found" || code === "auth/app-not-authorized"
                      ? "La aplicación web no está correctamente autorizada en el proyecto Firebase. Revisa la configuración del proyecto y sus dominios."
                      : code === "auth/invalid-email"
                        ? "El formato del correo no es válido."
                        : code === "auth/user-disabled"
                          ? "Esta cuenta está deshabilitada. Contacta con el administrador del concesionario."
                          : `Error de autenticación (${code || "sin código"}). Revisa Firebase Authentication y los dominios autorizados.`
      );
    } finally { setBusy(false); }
  };

  const saveMedia = () => {
    const next = { type: mediaType, url: mediaUrl.trim() };
    if (!next.url || !/^https?:\/\//i.test(next.url)) { setError("Introduce una dirección web válida para la imagen o el vídeo."); return; }
    setMedia(next);
    localStorage.setItem(MEDIA_KEY, JSON.stringify(next));
    setEditingMedia(false);
    setError("");
  };

  return (
    <main className="relative grid min-h-screen grid-cols-1 bg-white lg:grid-cols-2">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#07111f] lg:block">
        {media.type === "video" ? (
          <video key={media.url} className="absolute inset-0 h-full w-full object-cover" src={media.url} autoPlay muted loop playsInline />
        ) : (
          <img className="absolute inset-0 h-full w-full object-cover" src={media.url} alt="BMW en exposición" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/15" />
        <div className="absolute left-12 top-12 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#55c5e8]" /><span className="h-3 w-3 rounded-full bg-[#0877bd]" /><span className="h-3 w-3 rounded-full bg-[#e51b32]" />
        </div>
        <div className="absolute bottom-14 left-12 right-12 text-white">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-sky-300">Momentum Navarra</p>
          <h1 className="max-w-xl text-5xl font-light leading-tight tracking-tight">BMW Momentum<br/>Showroom</h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/75">Gestión profesional de exposición y stock para tu concesionario oficial BMW.</p>
        </div>
        <button type="button" onClick={() => { setEditingMedia(true); setError(""); }} className="absolute right-6 top-6 flex items-center gap-2 rounded-full border border-white/25 bg-black/30 px-3 py-2 text-xs font-medium text-white backdrop-blur transition hover:bg-black/50">
          <Settings2 className="h-4 w-4"/> Editar pantalla
        </button>
        {editingMedia && <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
            <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Personalización</p><h2 className="mt-1 text-xl font-semibold">Imagen o vídeo de portada</h2></div><button onClick={()=>setEditingMedia(false)} className="rounded-full p-2 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5"/></button></div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={()=>setMediaType("image")} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm ${mediaType==="image"?"border-blue-600 bg-blue-50 text-blue-700":"border-slate-200"}`}><ImagePlus className="h-4 w-4"/> Fotografía</button>
              <button type="button" onClick={()=>setMediaType("video")} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm ${mediaType==="video"?"border-blue-600 bg-blue-50 text-blue-700":"border-slate-200"}`}><Video className="h-4 w-4"/> Vídeo</button>
            </div>
            <label className="mb-2 block text-sm font-medium">URL pública {mediaType === "image" ? "de la imagen" : "del vídeo MP4"}</label>
            <input value={mediaUrl} onChange={e=>setMediaUrl(e.target.value)} placeholder={mediaType==="image"?"https://...jpg":"https://...mp4"} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"/>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">La dirección debe ser accesible públicamente. La elección se guarda en este navegador y se mantiene al volver a entrar desde el mismo dispositivo.</p>
            <button type="button" onClick={saveMedia} className="mt-5 w-full rounded-lg bg-[#0066b3] py-3 text-sm font-semibold text-white hover:bg-[#00549a]">Guardar portada</button>
          </div>
        </div>}
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><div className="mb-5 flex gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#55c5e8]"/><span className="h-2.5 w-2.5 rounded-full bg-[#0877bd]"/><span className="h-2.5 w-2.5 rounded-full bg-[#e51b32]"/></div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">Momentum Navarra</p><h1 className="mt-2 text-3xl font-light text-slate-900">BMW Momentum Showroom</h1></div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0066b3]">Acceso</p>
          <h2 className="mt-3 text-4xl font-light tracking-tight text-slate-900">Inicia sesión</h2>
          <p className="mt-3 text-sm text-slate-500">Accede a la plataforma de gestión de Momentum Navarra.</p>
          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div><label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-700">Email</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nombre@concesionario.com" className="h-13 w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#0066b3] focus:ring-4 focus:ring-blue-50"/></div>
            <div><label htmlFor="password" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-700">Contraseña</label><div className="relative"><input id="password" type={showPassword?"text":"password"} autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} className="h-13 w-full rounded-xl border border-slate-200 bg-white px-4 py-4 pr-12 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#0066b3] focus:ring-4 focus:ring-blue-50"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Ocultar contraseña":"Mostrar contraseña"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">{showPassword?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></div></div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={rememberEmail} onChange={e=>setRememberEmail(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#0066b3]"/> Recordar mi correo</label>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button disabled={busy} type="submit" className="flex h-12 w-full items-center justify-center rounded-xl bg-[#0066b3] text-sm font-semibold text-white shadow-sm transition hover:bg-[#00549a] disabled:cursor-not-allowed disabled:opacity-60">{busy?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Accediendo…</>:"Entrar"}</button>
          </form>
          <p className="mt-10 text-center text-xs text-slate-400">Acceso privado · BMW Momentum Navarra</p>
        </div>
      </section>
    </main>
  );
}
