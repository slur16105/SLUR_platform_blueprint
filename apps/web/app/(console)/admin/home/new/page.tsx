import ConsoleShell from "@/app/(console)/console-shell";
import FeatureForm from "../feature-form";

export default function AdminHomeNew() {
  return (
    <ConsoleShell role="admin" title="편성 추가" description="구매자 홈에 노출할 히어로·슬롯 편성을 새로 만듭니다.">
      <FeatureForm />
    </ConsoleShell>
  );
}
