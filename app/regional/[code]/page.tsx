import RegionHub from "@/components/RegionHub";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RegionHub code={decodeURIComponent(code).toUpperCase()} />;
}
