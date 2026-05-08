/**
 * Tournament-related utility functions and constants
 */

// Tier badge CSS class mapping
export const TIER_CLASSES = {
  'OURO': 'tierOuro',
  'PRATA': 'tierPrata',
  'BRONZE': 'tierBronze'
};

/**
 * Get CSS class name for a tournament tier
 * @param {string} tier - Tournament tier (OURO, PRATA, BRONZE)
 * @param {object} styles - CSS module styles object
 * @returns {string} CSS class name
 */
export function getTierClass(tier, styles) {
  const tierKey = tier?.toUpperCase();
  const className = TIER_CLASSES[tierKey];
  return className ? styles[className] : '';
}

// Category code to full label mapping
export const CATEGORY_LABELS = {
  'M1': 'Masculino Nivel 1',
  'M2': 'Masculino Nivel 2',
  'F1': 'Feminino Nivel 1',
  'F2': 'Feminino Nivel 2',
  'MX1': 'Misto Nivel 1',
  'MX2': 'Misto Nivel 2'
};

/**
 * Get full label for a category code
 * @param {string} code - Category code (M1, F1, MX1, etc.)
 * @returns {string} Full category label
 */
export function getCategoryLabel(code) {
  return CATEGORY_LABELS[code] || code;
}

/**
 * Get gender label from category code
 * @param {string} code - Category code
 * @returns {string} Gender label (Masculino, Feminino, Misto)
 */
export function getGenderFromCategory(code) {
  if (code?.startsWith('MX')) return 'Misto';
  if (code?.startsWith('M')) return 'Masculino';
  if (code?.startsWith('F')) return 'Feminino';
  return code;
}

/**
 * Get level from category code
 * @param {string} code - Category code
 * @returns {number} Level (1 or 2)
 */
export function getLevelFromCategory(code) {
  if (code?.endsWith('1')) return 1;
  if (code?.endsWith('2')) return 2;
  return null;
}

// Signup status colors
export const STATUS_COLORS = {
  pending: '#f39c12',
  confirmed: '#4CA69E',
  waitlist: '#9b59b6',
  cancelled: '#e74c3c',
  paired: '#3498db'
};

// Signup status labels (Portuguese)
export const STATUS_LABELS = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  waitlist: 'Lista Espera',
  cancelled: 'Cancelado',
  paired: 'Emparelhado'
};

/**
 * Get status color
 * @param {string} status - Signup status
 * @returns {string} Hex color code
 */
export function getStatusColor(status) {
  return STATUS_COLORS[status] || '#999';
}

/**
 * Get status label
 * @param {string} status - Signup status
 * @returns {string} Portuguese label
 */
export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

// Tournament status labels
export const TOURNAMENT_STATUS_LABELS = {
  scheduled: 'Brevemente',
  open_registration: 'Inscricoes Abertas',
  in_progress: 'A Decorrer',
  completed: 'Concluido',
  cancelled: 'Cancelado'
};

/**
 * Get tournament status label
 * @param {string} status - Tournament status
 * @returns {string} Portuguese label
 */
export function getTournamentStatusLabel(status) {
  return TOURNAMENT_STATUS_LABELS[status] || status;
}

// Skill pot descriptions
export const SKILL_POTS = [
  { value: 'pot1', label: 'Pot 1', description: 'Nivel mais alto' },
  { value: 'pot2', label: 'Pot 2', description: 'Nivel intermedio-alto' },
  { value: 'pot3', label: 'Pot 3', description: 'Nivel intermedio' },
  { value: 'pot4', label: 'Pot 4', description: 'Nivel iniciante' }
];

/**
 * Default avatar SVG for players without photos
 */
export const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="48" fill="%23e0e0e0"/%3E%3Ccircle cx="50" cy="38" r="18" fill="%23bdbdbd"/%3E%3Cellipse cx="50" cy="85" rx="28" ry="22" fill="%23bdbdbd"/%3E%3C/svg%3E';
