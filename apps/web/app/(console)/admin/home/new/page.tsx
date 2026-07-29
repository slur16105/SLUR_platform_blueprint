import ConsoleShell from "@/app/(console)/console-shell";
import FeatureForm from "../feature-form";

export default function AdminHomeNew() {
  return (
    <ConsoleShell role="admin" title="새 항목" description="구매자 앱 메인 화면에 노출할 히어로·슬롯을 새로 만듭니다.">
      <FeatureForm />
    </ConsoleShell>
  );
}
