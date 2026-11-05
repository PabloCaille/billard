// =====================================================================
// VUE : passage mètres <-> pixels (géométrie pure)
// Partagée par le Rendu (mètres -> pixels) et les Entrées (pixels de la
// souris -> mètres). Aucun des deux blocs ne dépend de l'autre.
// La vue est calculée UNE fois (main.js) et passée aux deux : un clic et
// l'affichage utilisent forcément la même transformation.
// =====================================================================

export const MARGIN_PX = 45; // bois + bande autour du tapis (px)

export function createView(canvasWidth, canvasHeight, table) {
  const scale = Math.min(
    (canvasWidth - 2 * MARGIN_PX) / table.length,
    (canvasHeight - 2 * MARGIN_PX) / table.width
  );
  return {
    scale, // px par mètre
    ox: (canvasWidth - table.length * scale) / 2,
    oy: (canvasHeight - table.width * scale) / 2,
    tableWidth: table.width,
  };
}

// Mètres (repère méca, y vers le haut) -> pixels du canvas (y vers le bas)
export function toScreen(view, p) {
  return {
    x: view.ox + p.x * view.scale,
    y: view.oy + (view.tableWidth - p.y) * view.scale,
  };
}

// Pixels du canvas -> mètres
export function toWorld(view, s) {
  return {
    x: (s.x - view.ox) / view.scale,
    y: view.tableWidth - (s.y - view.oy) / view.scale,
  };
}
