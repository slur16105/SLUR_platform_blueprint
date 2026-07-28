import ConsoleShell from "@/app/(console)/console-shell";
import FeatureForm from "../feature-form";

export default async function AdminHomeEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ConsoleShell role="admin" title="편성 수정" description="구매자 홈에 노출되는 편성 내용을 수정합니다.">
      <FeatureForm featureId={id} />
    </ConsoleShell>
  );
}
