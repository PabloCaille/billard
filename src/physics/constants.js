// =====================================================================
// CONSTANTES PHYSIQUES
// Fichier à part pour que tous les modules de physique puissent les lire
// sans import circulaire avec index.js.
// =====================================================================

export const PHYS = {
  g: 9.81,           // m/s²
  muSlide: 0.2,      // frottement de glissement bille/tapis
  muRoll: 0.01,      // résistance au roulement (empirique)
  airDensity: 1.2,   // kg/m³
  dragCoef: 0.47,    // Cx d'une sphère
  slipEpsilon: 1e-4, // m/s : en dessous, on considère que la bille roule
  ballRestitution: 0.95, // e_b : choc bille/bille (0,93 à 0,98 selon Alciatore)
  maxEventsPerStep: 64,  // garde-fou : nombre max de chocs traités dans un même pas
};
