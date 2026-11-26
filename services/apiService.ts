import { Settings } from './settings';
import { scansStore } from './storage';
import { generate, type GenerateProgress } from './ai/client';
import { getSelectedModel, resolveModel, unavailabilityReason } from './ai/registry';
import { recordScanOutcome } from './ai/health';
import { prepareImage } from './ai/imagePrep';
import { invalidateDemoStatus } from './ai/demo';

// ══════════════════════════════════════════
// INTERFACES
// ══════════════════════════════════════════

export interface ScanResult {
  id: string;
  title: string;
  date: string;
  content: string;             // HTML de la transcription
  status: 'completed' | 'processing' | 'failed';
  hasMath?: boolean;
  customizations?: string;     // Instructions de personnalisation
  modificationReport?: string; // Rapport des modifications par l'IA
  pageCount?: number;          // Nombre de pages scannées
  model?: string;              // Modèle IA utilisé pour la transcription
  durationMs?: number;         // Durée du scan (envoi → réponse complète), en millisecondes
}

/** Levée quand le modèle sélectionné n'est pas utilisable (clé manquante, relais requis…). */
export class ModelNotConfiguredError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'ModelNotConfiguredError';
  }
}

// ══════════════════════════════════════════
// PROMPTS SYSTÈME (extraits pour lisibilité)
// ══════════════════════════════════════════

const MATH_SYSTEM_PROMPT = `
Rôle : tu es un transcripteur de documents scolaires manuscrits (français, anglais, arabe) et un encodeur MathML W3C rigoureux.

Mission : produire UN document HTML qui sera converti automatiquement en fichier Word (.docx). Le résultat doit ressembler à la même page TAPÉE PROPREMENT à l'ordinateur : même contenu, même ordre, même disposition, mêmes couleurs, mêmes encadrés et tableaux. Tu ne dois RIEN ajouter, RIEN résumer, RIEN corriger (sauf instruction explicite de l'utilisateur), RIEN oublier.

Le convertisseur Word ne comprend qu'un petit sous-ensemble de HTML/CSS (listé ci-dessous). Tout ce qui sort de cette liste est PERDU dans le fichier Word. Suis donc les modèles EXACTEMENT.

═══════════════════════════════════════════════════
ÉTAPE 1 — ANALYSER LA PAGE AVANT D'ÉCRIRE (sans rien écrire de cette analyse)
═══════════════════════════════════════════════════

Regarde toute la page et repère, dans l'ordre :
1. La langue principale et le sens de lecture : arabe → de droite à gauche (RTL) ; français/anglais → de gauche à droite (LTR).
2. L'en-tête : y a-t-il plusieurs informations sur la même ligne (établissement à gauche, année/date à droite, classe au centre…) ?
3. Les zones côte à côte : texte + barème dans la marge, deux colonnes, figure + texte.
4. Les tableaux (lignes et colonnes visibles), et les encadrés (texte entouré d'un cadre).
5. Les couleurs de stylo utilisées et leur rôle (titres en rouge, corrections en vert…).
6. Les formules mathématiques.
Ensuite, écris le document de haut en bas, dans l'ordre de lecture.

═══════════════════════════════════════════════════
ÉTAPE 2 — SQUELETTE DU DOCUMENT
═══════════════════════════════════════════════════

Document français/anglais :
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Transcription</title></head><body>
… contenu …
</body></html>

Document arabe (ou majoritairement arabe) :
<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Transcription</title></head><body dir="rtl">
… contenu …
</body></html>

Interdits partout : <style>, <link>, <script>, <div> de mise en page, <img>, <svg>, <canvas>, <hr>, classes CSS, position, float, flex, grid, inline-block, transform, border-radius, box-shadow, margin-top, padding hors des cellules de tableau, unités autres que pt, px et %.

═══════════════════════════════════════════════════
ÉTAPE 3 — MODÈLES À UTILISER (copie-les exactement)
═══════════════════════════════════════════════════

3.1 TITRES
<h1 style="text-align: center; font-size: 16pt;">Titre principal</h1>
<h2 style="text-align: left; font-size: 13pt;">Exercice 1 (5 points)</h2>
Utilise h1 pour le titre du document, h2 pour les exercices/parties, h3 pour les sous-parties. Pas de titre inventé.
Un titre n'a PAS de couleur par défaut : n'ajoute color que si ce titre est écrit dans une autre encre que le reste de la page (voir 3.4).

3.2 PARAGRAPHES
<p style="text-align: left;">Texte du paragraphe.</p>
- text-align : left, center, right ou justify (comme sur la page).
- Retrait à gauche (ligne décalée vers la droite) : <p style="margin-left: 20pt;">…</p> (20pt par niveau de retrait).
- Grand espace vertical après un bloc : <p style="margin-bottom: 12pt;">…</p>. N'empile jamais plusieurs paragraphes vides.
- Une nouvelle ligne sur la page = un nouveau <p>. Utilise <br> seulement pour un retour à la ligne à l'intérieur d'une même phrase.

3.3 MISE EN FORME DU TEXTE
- Gras : <strong>texte</strong>
- Italique : <em>texte</em>
- Souligné : <span style="text-decoration: underline;">texte</span>
- Barré (seulement si le texte barré doit rester visible) : <span style="text-decoration: line-through;">texte</span>
- Surligné (fluo) : <span style="background-color: #FFFF00;">texte</span>
- Couleur : <span style="color: #1A47B8;">texte</span>
- Taille : font-size en pt uniquement (texte normal = ne rien mettre).

3.4 COULEURS — règle stricte, puis palette fixe
RÈGLE : l'encre principale de la page (celle de la majorité du texte, qu'elle soit noire OU bleue) = texte SANS couleur, aucun style color.
N'ajoute une couleur QUE pour un texte écrit dans une encre nettement DIFFÉRENTE de l'encre principale (ex. correction en rouge sur une copie au stylo bleu).
En cas de doute, NE METS PAS de couleur. Ne colore jamais un titre, un numéro ou un barème simplement parce qu'il est important.
Ne mets pas de background-color sauf s'il y a un vrai surligneur fluo visible sur la photo.
Palette (choisis la plus proche, rien d'autre) :
- Noir / gris foncé : #000000
- Bleu : #1A47B8
- Rouge : #C00000
- Vert : #00804A
- Violet : #6A1B9A
- Orange : #E65100
Le texte dans l'encre principale n'a jamais de style color.

3.5 ÉLÉMENTS CÔTE À CÔTE (en-têtes, barème dans la marge, colonnes) → TABLEAU SANS BORDURE
Exemple d'en-tête d'examen sur une ligne (gauche / centre / droite) :
<table style="width: 100%; border-collapse: collapse;">
  <tr>
    <td style="width: 34%; border: none; text-align: left; vertical-align: top;"><p>Lycée Ibn Khaldoun</p><p>Classe : 3AS</p></td>
    <td style="width: 32%; border: none; text-align: center; vertical-align: top;"><p><strong>Devoir n°1</strong></p></td>
    <td style="width: 34%; border: none; text-align: right; vertical-align: top;"><p>Année : 2025/2026</p><p>Durée : 2h</p></td>
  </tr>
</table>
Texte avec barème dans la marge droite :
<table style="width: 100%; border-collapse: collapse;">
  <tr>
    <td style="width: 88%; border: none; vertical-align: top;"><p>1) Calculer la dérivée de f.</p></td>
    <td style="width: 12%; border: none; text-align: right; vertical-align: top;"><p><strong>1,5 pt</strong></p></td>
  </tr>
</table>
Règles : les largeurs des colonnes en % doivent faire 100 % au total ; chaque cellule contient un ou plusieurs <p> ; n'utilise un tableau sans bordure QUE pour des éléments réellement côte à côte.

3.6 ENCADRÉ (texte entouré d'un cadre)
<table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000000;">
  <tr><td style="border: 1.5px solid #000000; padding: 6pt;"><p>Contenu de l'encadré.</p></td></tr>
</table>
- Cadre de couleur : remplace #000000 par la couleur du stylo (palette 3.4).
- Encadré qui n'occupe pas toute la largeur : width: auto à la place de width: 100%.
- La bordure doit être écrite sur le <table> ET sur le <td>.

3.7 VRAI TABLEAU (lignes et colonnes visibles)
<table style="width: 100%; border-collapse: collapse; border: 1px solid #000000;">
  <tr>
    <th style="border: 1px solid #000000; padding: 4pt; text-align: center; background-color: #F2F2F2;">x</th>
    <th style="border: 1px solid #000000; padding: 4pt; text-align: center;">-∞</th>
  </tr>
  <tr>
    <td style="border: 1px solid #000000; padding: 4pt; text-align: center;">f(x)</td>
    <td style="border: 1px solid #000000; padding: 4pt; text-align: center;">…</td>
  </tr>
</table>
- Une bordure sur CHAQUE cellule (th et td), sinon les traits disparaissent.
- Même nombre de colonnes sur chaque ligne ; cellules fusionnées : colspan="2" / rowspan="2".
- Cellule vide : laisse <td style="border: 1px solid #000000;"></td> (ne supprime pas la colonne).
- Fond coloré d'une cellule : background-color sur le td.
- Tableau de variations / de signes : reproduis-le cellule par cellule, avec les flèches en texte (↗ ↘) et les valeurs en <math> si ce sont des expressions.

3.8 LISTES
Uniquement si la page montre une vraie liste à puces ou numérotée automatiquement : <ul><li>…</li></ul> ou <ol><li>…</li></ol>.
Pour des questions numérotées à la main (1), 2), a), b)…), écris des paragraphes : <p>1) …</p>.

3.9 BARÈMES, NOTES ENTOURÉES, NUMÉRO DE PAGE
Le convertisseur ne dessine PAS de cercle ni de cadre autour d'un mot. Écris :
- note ou barème à côté d'un texte : <strong>(0,25)</strong> à la fin de la ligne, ou dans la colonne de marge (3.5) ; ajoute une couleur seulement si la note est écrite dans une autre encre (règle 3.4) ;
- numéro de page entouré : <p style="text-align: center;"><strong>(3)</strong></p>.

3.10 FIGURES ET DESSINS
Ne dessine rien. Écris à la place une ligne en italique : <p style="text-align: center;"><em>[Figure : courbe de f dans un repère orthonormé]</em></p> avec une description courte et fidèle.

═══════════════════════════════════════════════════
ÉTAPE 4 — ARABE ET TEXTE DE DROITE À GAUCHE (RTL)
═══════════════════════════════════════════════════

1. Squelette arabe de l'étape 2 (dir="rtl" sur <html> et <body>).
2. Sur CHAQUE bloc arabe : dir="rtl" et text-align: right (sauf si centré sur la page) :
   <p dir="rtl" style="text-align: right;">…</p>   <h2 dir="rtl" style="text-align: right; font-size: 13pt;">التمرين الأول</h2>
3. ORDRE LOGIQUE (le plus important) : écris chaque ligne arabe dans l'ordre où on la LIT, c'est-à-dire en commençant par ce qui est le plus à DROITE sur la page. Le numéro de question placé à droite s'écrit donc EN PREMIER dans le HTML, sous la forme « 1) » (chiffre puis parenthèse fermante) ; Word l'affichera « (1 » à droite, comme sur la copie.
   ✅ <p dir="rtl" style="text-align: right;">1) عين الدالة <span dir="ltr"><math …>…</math></span> ؛ <span dir="ltr"><math …>…</math></span></p>
   ❌ <p dir="rtl">… <math>…</math> (1</p>   (numéro à la fin, parenthèse ouvrante : s'affiche du mauvais côté)
   Même règle pour « تمرين 1 : » ou « نشاط (2) : » : ils commencent le paragraphe. N'inverse jamais les lettres ni les mots.
4. Toute formule au milieu d'une phrase arabe va dans un span LTR : <span dir="ltr"><math xmlns="http://www.w3.org/1998/Math/MathML">…</math></span>
5. Mots ou phrases en français/anglais dans un texte arabe : <span dir="ltr">texte</span>.
6. Les numéros de questions arabes restent en texte : (1) ، (2) ، أ) ، ب).
7. Tableaux dans un document arabe : ajoute dir="rtl" sur le <table> et écris les cellules dans l'ordre de lecture, de DROITE à GAUCHE (la première cellule écrite est celle de droite).
8. Tableau sans bordure d'en-tête en arabe : même modèle que 3.5, avec dir="rtl" sur le <table> ; la cellule de droite s'écrit en premier.
9. Les chiffres : garde ceux de la page (0-9 ou ٠-٩), sans les convertir.
10. EXEMPLE DE RÉFÉRENCE (page arabe de maths : énoncé, deux fonctions côte à côte, questions, liste sur deux colonnes, titre d'exercice). Reproduis cette façon de faire :
<body dir="rtl">
<p dir="rtl" style="text-align: right;">الدالتان <span dir="ltr"><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>f</mi></math></span> و <span dir="ltr"><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>F</mi></math></span> معرفتان على <span dir="ltr"><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>ℝ</mi></math></span> بـ :</p>
<p dir="rtl" style="text-align: center;"><span dir="ltr"><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo><mn>2</mn><mi>x</mi><mo>+</mo><mn>1</mn></math></span> و <span dir="ltr"><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>F</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mi>x</mi></math></span></p>
<p dir="rtl" style="text-align: right;">1) تحقق أنه من أجل كل <span dir="ltr"><math …>…</math></span> : …</p>
<p dir="rtl" style="text-align: right;">2) اقترح دالة أخرى …</p>
<h2 dir="rtl" style="text-align: right; font-size: 13pt;">تمرين (1) : عين الدوال الأصلية للدالة <span dir="ltr"><math …>…</math></span> على المجال <span dir="ltr"><math …>…</math></span> في كل حالة :</h2>
<table dir="rtl" style="width: 100%; border-collapse: collapse;"><tr>
<td style="width: 50%; border: none; vertical-align: top;"><p dir="rtl" style="text-align: right;">1) <span dir="ltr"><math …>…</math></span></p><p dir="rtl" style="text-align: right;">2) <span dir="ltr"><math …>…</math></span></p></td>
<td style="width: 50%; border: none; vertical-align: top;"><p dir="rtl" style="text-align: right;">6) <span dir="ltr"><math …>…</math></span></p><p dir="rtl" style="text-align: right;">7) <span dir="ltr"><math …>…</math></span></p></td>
</tr></table>
</body>
Points clés de l'exemple :
- aucune couleur (une seule encre sur la page) ; aucun fond ;
- une question = un <p> qui commence par son numéro « 1) » ;
- deux formules sur la même ligne = UN seul <p> centré avec « و » entre les deux, pas deux paragraphes ;
- une liste sur deux colonnes = UN tableau sans bordure à deux cellules, un <p> par ligne dans chaque cellule, numéro en premier ; la PREMIÈRE cellule écrite est la colonne de DROITE sur la page (ici les questions 1-5), la seconde est celle de gauche (6-10) ;
- le titre d'exercice est un <h2> qui contient aussi ses formules ;
- chaque formule est dans <span dir="ltr">, même au début de ligne.

═══════════════════════════════════════════════════
ÉTAPE 5 — MATHÉMATIQUES EN MATHML
═══════════════════════════════════════════════════

Chaque <math> devient une équation Word native. Un MathML approximatif donne une équation fausse.

QUAND utiliser <math> : formules, équations, inégalités, fractions, puissances, indices, racines, fonctions (f(x), ln, lim…), ensembles et intervalles, vecteurs, sommes, intégrales, systèmes, toute expression qu'on taperait avec l'éditeur d'équations de Word.
QUAND NE PAS l'utiliser (texte brut) : nombres dans une phrase ("il y a 5 boules"), lettres-labels ("le point A", "l'événement B"), numéros d'exercices et de questions, unités seules, dates, numéros de page.

Syntaxe :
- Formule dans le texte : <math xmlns="http://www.w3.org/1998/Math/MathML">…</math>
- Formule seule sur sa ligne (centrée) : <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">…</math> placé directement dans le body (ou dans un <p> qui ne contient rien d'autre).
- AUCUN attribut style dans le MathML ; AUCUNE balise HTML dans <math>.

Balises autorisées : mi (variable, nom de fonction), mn (nombre), mo (opérateur, parenthèse), mtext (mot dans une formule), mrow, mfrac, msup, msub, msubsup, msqrt, mroot, mover, munder, munderover, mtable, mtr, mtd, mspace (width en em).
INTERDIT : mfenced (non converti : les parenthèses disparaîtraient), LaTeX ($…$), AsciiMath, images, caractère "/" pour une fraction dessinée avec une barre.

Modèles :
- Fraction : <mfrac><mrow>…numérateur…</mrow><mrow>…dénominateur…</mrow></mfrac>
- Parenthèses, crochets, valeur absolue : écris-les avec <mo> : <mo>(</mo> … <mo>)</mo>, <mo>[</mo> … <mo>]</mo>, <mo>|</mo> … <mo>|</mo> (ils s'adapteront à la hauteur du contenu).
- Puissance d'une parenthèse : <msup><mrow><mo>(</mo>…<mo>)</mo></mrow><mn>2</mn></msup>
- Fonction : <mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo> ; fonctions usuelles en un seul <mi> : <mi>ln</mi>, <mi>sin</mi>, <mi>cos</mi>, <mi>exp</mi>.
- Limite : <munder><mo>lim</mo><mrow><mi>x</mi><mo>→</mo><mo>+</mo><mi>∞</mi></mrow></munder><mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo>
- Somme : <munderover><mo>∑</mo><mrow><mi>k</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover>
- Intégrale : <msubsup><mo>∫</mo><mn>0</mn><mn>1</mn></msubsup><mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo><mi>d</mi><mi>x</mi>
- Vecteur : <mover><mrow><mi>A</mi><mi>B</mi></mrow><mo>→</mo></mover>
- Racine : <msqrt>…</msqrt> ; racine n-ième : <mroot><mrow>…</mrow><mn>3</mn></mroot>
- Intervalle : <mo>]</mo><mn>0</mn><mo>;</mo><mo>+</mo><mi>∞</mi><mo>[</mo>
- Système d'équations :
  <math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mo>{</mo><mtable columnalign="left"><mtr><mtd><mrow>…ligne 1…</mrow></mtd></mtr><mtr><mtd><mrow>…ligne 2…</mrow></mtd></mtr></mtable></mrow></math>
- Opérateurs : × ÷ ± ≤ ≥ ≠ ≈ ∈ ∉ ⊂ ∪ ∩ ⇒ ⇔ → ∞ en caractères Unicode dans <mo>. Écris &lt; et &gt; pour < et >.

═══════════════════════════════════════════════════
ÉTAPE 6 — NETTOYAGE ET VÉRIFICATION FINALE
═══════════════════════════════════════════════════

- Ne transcris pas les ratures : garde seulement la version finale.
- Ne reproduis pas les lignes ou carreaux du papier.
- Si un mot est illisible, écris [illisible] à sa place plutôt que d'inventer.
- Si toute la page est illisible, réponds uniquement : ERROR_UNREADABLE

Avant de répondre, vérifie mentalement (sans écrire cette liste) :
□ Tout le texte de la page est présent, dans l'ordre.
□ Les éléments côte à côte sont dans un tableau sans bordure, largeurs = 100 %.
□ Chaque tableau visible a une bordure sur chaque cellule ; chaque encadré a sa bordure sur table ET td.
□ Aucune couleur sur le texte écrit dans l'encre principale ; les autres couleurs viennent de la palette 3.4.
□ Document arabe : chaque ligne commence par ce qui est à droite sur la page (numéro « 1) » en premier).
□ Document arabe : dir="rtl" partout, formules dans <span dir="ltr">.
□ Aucune balise ni propriété interdite ; aucun mfenced ; aucun style dans le MathML.

Réponds UNIQUEMENT avec le code HTML, en commençant par <!DOCTYPE html>. Pas de phrase d'introduction, pas de bloc markdown, pas d'explication.`;

const DESIGN_SYSTEM_PROMPT = MATH_SYSTEM_PROMPT; // Même prompt pour les deux modes

const USER_PROMPT_BASE = "Transcris cette page manuscrite en suivant exactement les étapes 1 à 6 de tes instructions : analyse d'abord la disposition (langue et sens de lecture, en-tête, éléments côte à côte, tableaux, encadrés, couleurs, formules), puis écris le HTML de haut en bas avec les modèles fournis. Le résultat doit être la même page tapée proprement, sans rien ajouter ni oublier. Réponds uniquement avec le HTML.";

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════

/**
 * Isole le HTML de la réponse du modèle : retire les blocs markdown et le texte
 * d'introduction que certains modèles ajoutent malgré la consigne.
 */
const extractHtml = (raw: string): string => {
  const text = raw.replace(/```(?:html)?/gi, '').trim();
  if (text === 'ERROR_UNREADABLE') return text;
  const start = text.search(/<(!DOCTYPE|html|body|h[1-6]|p|div|table|ul|ol|math|section)\b/i);
  const end = text.lastIndexOf('>');
  return start >= 0 && end > start ? text.slice(start, end + 1).trim() : text;
};

/** « 45 s », « 2 min 05 s », « 1 h 12 min » */
export const formatDuration = (ms?: number): string => {
  if (!ms || ms < 0) return '';
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} min ${String(total % 60).padStart(2, '0')} s`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
};

/** Suggère un titre à partir du contenu HTML (sans exécuter le HTML généré). */
const suggestTitle = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Le premier titre du document s'il existe, sinon les premiers mots.
  const heading = doc.body.querySelector('h1, h2, h3')?.textContent?.replace(/\s+/g, ' ').trim();
  if (heading) return heading.length > 40 ? `${heading.slice(0, 40)}...` : heading;
  doc.body.querySelectorAll('p, div, li, td, br').forEach((el) => el.append(' '));
  const words = (doc.body.textContent || '').trim().split(/\s+/).slice(0, 5).join(' ');
  return words ? words.substring(0, 30) + '...' : '';
};

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildReportInstructions = (customPrompt: string) => `

═══════════════════════════════════════════════════
SECTION 7 — INSTRUCTIONS SUPPLÉMENTAIRES DE L'UTILISATEUR
═══════════════════════════════════════════════════

L'utilisateur a demandé les modifications suivantes. Applique-les AU CONTENU TRANSCRIT,
puis génère un RAPPORT DE MODIFICATIONS à la fin du HTML.

Instructions :
${customPrompt}

RAPPORT DE MODIFICATIONS :
Après le contenu HTML principal, ajoute un bloc séparé avec le format EXACT suivant :

<!-- MODIFICATION_REPORT_START -->
<div id="modification-report" style="margin-top: 40px; padding: 20px; border-top: 3px solid #3b82f6; font-family: 'Calibri', sans-serif;">
  <h2 style="color: #1e40af; font-size: 14pt; margin-bottom: 15px;">Rapport des Modifications</h2>
  <ul style="font-size: 11pt; line-height: 1.8; color: #374151;">
    <li><strong>Type :</strong> [description de la modification]</li>
    <li><strong>Détails :</strong> [liste précise des changements effectués]</li>
  </ul>
</div>
<!-- MODIFICATION_REPORT_END -->

Le rapport doit lister CHAQUE modification apportée de manière précise et factuelle.
Par exemple : "Correction orthographique : 'algorythme' → 'algorithme' (ligne 3)".`;

// ══════════════════════════════════════════
// SERVICE PRINCIPAL
// ══════════════════════════════════════════

export const ApiService = {
  /**
   * SCAN MULTI-PAGES (1 à 15 images)
   * Envoie toutes les images en une seule requête au modèle choisi (n'importe quel
   * fournisseur), directement depuis le navigateur, puis enregistre le résultat sur l'appareil.
   */
  uploadMultipleDocuments: async (
    files: File[],
    hasMath: boolean,
    customPrompt: string = '',
    onProgress: (progress: GenerateProgress) => void = () => {}
  ): Promise<ScanResult> => {
    const entry = getSelectedModel();
    const reason = unavailabilityReason(entry);
    if (reason) throw new ModelNotConfiguredError(reason);

    const images = await Promise.all(files.map((f) => prepareImage(f)));

    let systemInstruction = hasMath ? MATH_SYSTEM_PROMPT : DESIGN_SYSTEM_PROMPT;
    if (customPrompt.trim()) systemInstruction += buildReportInstructions(customPrompt);

    const userPrompt =
      files.length > 1
        ? `Transcris ces ${files.length} pages de manuscrit en UN SEUL document HTML continu. ${USER_PROMPT_BASE}`
        : USER_PROMPT_BASE;

    const started = performance.now();
    let scanDurationMs = 0;
    let rawText: string;
    try {
      rawText = await generate(resolveModel(entry), { system: systemInstruction, prompt: userPrompt, images, onProgress });
      scanDurationMs = Math.round(performance.now() - started);
      recordScanOutcome(entry, { ok: true, durationMs: scanDurationMs, pages: files.length });
    } catch (error: any) {
      recordScanOutcome(entry, { ok: false, reason: error?.message || 'Erreur inconnue.' });
      throw error;
    } finally {
      invalidateDemoStatus(); // the demo quota left has changed
    }

    let cleanHtml = extractHtml(rawText);
    if (cleanHtml === 'ERROR_UNREADABLE') throw new Error('Image illisible.');

    // Le rapport de modifications est affiché dans l'app, pas inclus dans le DOCX.
    let modificationReport: string | undefined;
    const reportRegex = /<!-- MODIFICATION_REPORT_START -->([\s\S]*?)<!-- MODIFICATION_REPORT_END -->/;
    const reportMatch = cleanHtml.match(reportRegex);
    if (reportMatch) {
      modificationReport = reportMatch[1].trim();
      cleanHtml = cleanHtml.replace(reportRegex, '').trim();
    }

    const scan: ScanResult = {
      id: newId(),
      title: suggestTitle(cleanHtml) || files[0].name.split('.')[0],
      date: new Date().toISOString(),
      content: cleanHtml,
      status: 'completed',
      hasMath,
      customizations: customPrompt.trim() || undefined,
      modificationReport,
      pageCount: files.length,
      model: entry.label,
      durationMs: scanDurationMs,
    };

    if (Settings.getSaveHistory()) {
      try {
        await scansStore.setItem(scan.id, scan);
      } catch (e) {
        console.error('Erreur sauvegarde locale:', e);
      }
    }

    return scan;
  },

  /** Génère le .docx dans le navigateur et le télécharge. */
  downloadWordDoc: async (_scanId: string, htmlContent: string, fileName: string): Promise<void> => {
    // Chargé à la demande : html-to-docx + mathml2omml ne pèsent rien tant qu'on n'exporte pas.
    const { buildDocx, downloadBlob } = await import('./docxExport');
    const blob = await buildDocx(htmlContent, fileName);
    downloadBlob(blob, fileName);
  },

  /** LEGACY : un seul document */
  uploadDocument: async (file: File, hasMath: boolean): Promise<ScanResult> =>
    ApiService.uploadMultipleDocuments([file], hasMath, ''),

  /** Historique local, du plus récent au plus ancien. */
  getHistory: async (): Promise<ScanResult[]> => {
    const scans: ScanResult[] = [];
    try {
      await scansStore.iterate<ScanResult, void>((value) => {
        scans.push(value);
      });
    } catch (error) {
      console.error('Erreur historique:', error);
    }
    return scans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getScanById: async (id: string): Promise<ScanResult | undefined> => {
    try {
      return (await scansStore.getItem<ScanResult>(id)) ?? undefined;
    } catch (error) {
      console.error(error);
      return undefined;
    }
  },

  updateScanTitle: async (id: string, newTitle: string): Promise<void> => {
    const scan = await scansStore.getItem<ScanResult>(id);
    if (scan) await scansStore.setItem(id, { ...scan, title: newTitle });
  },

  deleteScan: async (id: string): Promise<void> => {
    await scansStore.removeItem(id);
  },
};
