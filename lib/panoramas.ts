// As visões de Panorama da dashboard e como aparecem no menu e na URL (?visao=...).

export type PanoramaKind = "vertical" | "horizontal" | "california" | "content-house";

export const PANORAMAS: { kind: PanoramaKind; visao: string; label: string; team?: string; hint: string }[] = [
  { kind: "vertical", visao: "panorama", label: "Panorama Vertical", hint: "Regionais e times em sequência, rolando a página" },
  { kind: "horizontal", visao: "horizontal", label: "Panorama Horizontal", hint: "California e Content House em uma única tela, para monitores ultra-wide" },
  { kind: "california", visao: "california", label: "Panorama California", team: "california", hint: "Só a California, todas as regionais em uma única tela" },
  { kind: "content-house", visao: "content-house", label: "Panorama Content House", team: "content house", hint: "Só a Content House, todas as regionais em uma única tela" },
];

export const panoramaByVisao = (v: string | null) => PANORAMAS.find((p) => p.visao === v) ?? null;
export const panoramaInfo = (k: PanoramaKind) => PANORAMAS.find((p) => p.kind === k)!;
