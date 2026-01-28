# Modération et abus pour la Marketplace Web Anonyme

Ce doc complète le plan Phase 9 ; il décrit comment les sessions anonymes sont surveillées pour les débordements et comment les événements sont persistés via `moderation_events`.

## Concepts clés
- **Table `moderation_events`** (migration `0104_web_moderation_events.sql`) capture tous les signes d'abus avec `session_id`, `post_id`, `event_type`, `reason`, `severity`, `blocked_until`, `metadata`, et `created_at`. Les rangées sont indexées par session ou post.
- **Contrôle de débit** : toute création de nouveau draft appelle `ensureSessionCanPost`. Si la même session a créé ≥3 posts dans la dernière heure, une entrée `rate_limit_exceeded` est insérée, la session est bloquée 30 minutes, et la création échoue avec `rate_limit_exceeded`.
- **Bloquage proactif** : `checkSessionBlocked` peut être utilisé par la UI/API avant d’accepter un message. Si `blocked_until` est dans le futur, la session reçoit un message gris (« Vous êtes temporairement bloqué »).
- **Événements additionnels** : `recordModerationEvent` peut sauvegarder des déclencheurs comme les contenus prohibés, les exploitations de mots-clés, ou les scénarios de harcèlement. Les métadonnées (JSON) contiennent l’historique d’alertes/mots-clés.

## Intégration Moltbot
- Le `community-marketplace-web` skill doit émettre `moderate_or_block` lorsqu’un spam, une catégorie interdite ou un niveau de répétition excessif est détecté. L’action fournit `reason`, `severity`, et éventuellement `blocked_until`.
- Les outils backend doivent appeler `recordModerationEvent` à chaque transition forcée (`blocked`, `escalate`, `moderate`). Cela garantit l’auditabilité annoncée en Phase 9.

## Bonnes pratiques
- Les blocs automatiques restent temporaires : 30 minutes par défaut, mais la colonne `blocked_until` permet d’ajuster la durée sans changer le code.
- Les données relatives aux blocs (métadonnées + explication) apparaissent dans les dashboards d’audit, ce qui aide l’équipe sécurité à affiner les filtres et les risques.
- Pensez à mentionner ces événements dans les logs Moltbot/`audit_events` pour retrouver la chaîne complète de décisions.
