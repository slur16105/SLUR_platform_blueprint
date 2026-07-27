import FeatureForm from "../feature-form";

export default async function AdminHomeEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FeatureForm featureId={id} />;
}
