import { BrandWordmark } from "@/components/BrandWordmark";
import { Link, useLocation } from "wouter";

export default function AuthPage({ create = false }: { create?: boolean }) {
  const [, navigate] = useLocation();
  const continueWithGoogle = () => {
    window.location.assign(`/api/auth/google/start?origin=${encodeURIComponent(window.location.origin)}`);
  };
  const title = create ? "Create your account" : "Log in";
  const description = create
    ? "Start your private space for learning from what you read."
    : "Pick up where you left off—with your materials, notes, and progress ready.";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f7f5] px-5 py-10 text-[#212124] sm:px-8">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,120,255,.10),transparent_34%),radial-gradient(circle_at_10%_90%,rgba(255,220,154,.14),transparent_28%)]" />
      <div className="relative w-full max-w-[31rem]">
        <Link href="/" className="mb-6 flex justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#7362df] focus-visible:ring-offset-4">
          <BrandWordmark className="text-[1.12rem] text-[#27252d]" />
        </Link>

        <section aria-labelledby="auth-title" className="rounded-[1.05rem] border border-[#dededb] bg-white px-7 py-9 shadow-[0_20px_56px_rgba(42,37,54,.07)] sm:px-10 sm:py-10">
          <header className="text-center">
            <h1 id="auth-title" className="text-[2rem] font-bold tracking-[-.045em] text-[#242328] sm:text-[2.2rem]">{title}</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#77757d]">{description}</p>
          </header>

          <div className="mt-8">
            <button
              type="button"
              onClick={continueWithGoogle}
              className="flex h-13 w-full items-center justify-center gap-3 rounded-xl border border-[#dad9d7] bg-[#fcfcfb] px-5 text-[0.95rem] font-semibold text-[#29272d] shadow-[0_2px_0_rgba(29,28,32,.12)] transition duration-150 hover:bg-[#f7f7f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7362df] focus-visible:ring-offset-2 active:scale-[.98]"
            >
              <span aria-hidden="true" className="grid h-5 w-5 place-items-center text-[1.2rem] font-bold leading-none text-[#4285f4]">G</span>
              Continue with Google
            </button>
          </div>

          <div className="my-8 flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-[#e8e7e5]" /><span className="h-1.5 w-1.5 rounded-full bg-[#ddd9f6]" /><span className="h-px flex-1 bg-[#e8e7e5]" /></div>

          <p className="text-center text-sm leading-6 text-[#77757d]">Google uses your verified email. ZhiyaAI does not use a password.</p>

          <p className="mt-8 text-center text-sm text-[#77757d]">
            {create ? "Already have an account?" : "New to ZhiyaAI?"}{" "}
            <button type="button" onClick={() => navigate(create ? "/login" : "/create-account")} className="font-semibold text-[#6353d9] underline decoration-[#bbb2f6] underline-offset-4 transition hover:text-[#4f3fc6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7362df] focus-visible:ring-offset-2">
              {create ? "Log in" : "Create an account"}
            </button>
          </p>
        </section>

        <p className="mx-auto mt-6 max-w-md text-center text-xs leading-5 text-[#8a8890]">By continuing, you agree to use ZhiyaAI responsibly. Your learning materials stay private to your account.</p>
      </div>
    </main>
  );
}
