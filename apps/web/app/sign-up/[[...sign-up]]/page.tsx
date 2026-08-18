import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="bg-surface flex min-h-screen items-center justify-center px-6 py-12">
      <SignUp />
    </main>
  );
}
