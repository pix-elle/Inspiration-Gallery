export default function AboutPage() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center gap-3">
      <h1 className="text-lg font-semibold">À propos</h1>
      <p className="text-sm leading-relaxed text-foreground/60">
        Une galerie d&apos;inspiration en architecture retail : vitrines,
        pop-ups et aménagements de boutiques, repérés sur le terrain puis
        filmés et photographiés.
      </p>
      <p className="text-sm leading-relaxed text-foreground/60">
        Chaque projet est classé par marque, par type — pop-up ou boutique —
        et par ville, pour retrouver ce qui se fait ailleurs avant de dessiner
        ce qui se fera ici.
      </p>
    </div>
  );
}
