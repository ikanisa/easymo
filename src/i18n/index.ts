/**
 * i18n Module
 *
 * Language detection and template management for multilingual WhatsApp concierge.
 */

export { Language, detectLanguage, parseExplicitOverride, shouldUpdateLanguage } from './detectLanguage';
export { TemplateKey, getTemplate, renderTemplate, TEMPLATES } from './templates';
