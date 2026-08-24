// Isolé de queries.ts, qui importe le driver Neon et `undici`. La table des
// marques affiche l'identifiant d'URL pendant la frappe, donc elle a besoin de
// cette fonction côté navigateur — et l'importer depuis queries.ts y
// embarquerait toute la couche base de données.
//
// Serveur et client DOIVENT calculer le même slug : c'est ce qui garantit que
// l'avertissement « ce lien cessera de fonctionner » dit la vérité.
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // « Café » et « Cafe » donnent le même slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
