import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="bg-surface flex min-h-screen items-center justify-center">
      <SignIn />
    </main>
  );
}
