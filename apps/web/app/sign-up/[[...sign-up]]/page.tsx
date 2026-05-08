import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="bg-surface flex min-h-screen items-center justify-center">
      <SignUp />
    </main>
  );
}
