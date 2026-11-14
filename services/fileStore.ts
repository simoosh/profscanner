/**
 * fileStore — Module-level store pour passer les fichiers entre pages
 * 
 * On ne peut PAS passer des objets File[] via react-router navigate(state)
 * car sur les appareils peu puissants, React Router essaie de sérialiser 
 * les objets File (qui contiennent des blobs de plusieurs MB), ce qui 
 * provoque un crash/reload de la page.
 * 
 * Solution : stocker les fichiers dans une variable module-level et 
 * les récupérer depuis la page Customize.
 */

let _pendingFiles: File[] = [];
let _pendingHasMath: boolean = false;

export const fileStore = {
  /** Enregistre les fichiers sélectionnés (avant navigation vers /customize) */
  set(files: File[], hasMath: boolean) {
    _pendingFiles = files;
    _pendingHasMath = hasMath;
  },

  /** Récupère les fichiers enregistrés */
  get(): { files: File[]; hasMath: boolean } {
    return { files: _pendingFiles, hasMath: _pendingHasMath };
  },

  /** Vide le store après utilisation */
  clear() {
    _pendingFiles = [];
    _pendingHasMath = false;
  },

  /** Vérifie si des fichiers sont en attente */
  hasPending(): boolean {
    return _pendingFiles.length > 0;
  },
};
