import ConsoleShell from "@/app/(console)/console-shell";
import FeatureForm from "../feature-form";

export default async function AdminHomeEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ConsoleShell role="admin" title="항목 수정" description="구매자 앱 메인 화면에 노출되는 항목을 수정합니다.">
      <FeatureForm featureId={id} />
    </ConsoleShell>
  );
}
