import { useRouter } from "expo-router";
import { InsuranceForm } from "@/components/InsuranceForm";

export default function NewInsuranceScreen() {
  const router = useRouter();

  return (
    <InsuranceForm
      isEdit={false}
      onBack={() => router.back()}
      onSaved={() => router.navigate("/(app)/(tabs)")}
    />
  );
}
