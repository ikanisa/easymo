/**
 * Standardized location-related messages
 * Phase 2.3: Update empty state messages with sharing instructions
 */

export function getEmptyLocationsMessage(locale = "en"): string {
  const messages: Record<string, string> = {
    en: `📍 **No Saved Locations Yet**

Save your favorite places for quick access:

**How to share a location:**
1. Tap the 📎 (paperclip) button
2. Select *Location*
3. Share your current location OR search for an address

**Why save locations?**
• Faster ride bookings
• Consistent addresses
• No more typing coordinates
• Save Home, Work, or any favorite spot

Ready to save your first location?`,

    fr: `📍 **Aucun Lieu Enregistré**

Enregistrez vos lieux préférés pour un accès rapide:

**Comment partager un emplacement:**
1. Appuyez sur le bouton 📎 (trombone)
2. Sélectionnez *Position*
3. Partagez votre position actuelle OU recherchez une adresse

**Pourquoi enregistrer des lieux?**
• Réservations plus rapides
• Adresses cohérentes  
• Plus besoin de taper les coordonnées
• Enregistrez Maison, Travail ou tout lieu préféré

Prêt à enregistrer votre premier lieu?`,

    rw: `📍 **Nta Hantu Wabitse**

Bika ahantu ukunda kugira ngo uhabone byihuse:

**Uburyo bwo gusangira aho uri:**
1. Kanda buto ya 📎 (agakwambi)
2. Hitamo *Aho uri*
3. Sangira aho uri ubu CYANGWA shakisha aderesi

**Kuki ubika ahantu?**
• Gutumiza modoka byihuse
• Aderesi ihoraho
• Ntukongera kwandika koordine
• Bika urugo, akazi, cyangwa undi hantu ukunda

Witeguye kubika ahantu utangiye?`,
  };

  return messages[locale] || messages.en;
}

export function getDuplicateLocationMessage(
  existingLabel: string,
  distance: number,
  locale = "en"
): string {
  if (distance === 0) {
    const messages: Record<string, string> = {
      en: `✅ You already have *${existingLabel}* saved at this exact location.`,
      fr: `✅ Vous avez déjà *${existingLabel}* enregistré à cet endroit exact.`,
      rw: `✅ Usanzwe ufite *${existingLabel}* yabitswe kuri iyi aderesi.`,
    };
    return messages[locale] || messages.en;
  }

  const messages: Record<string, string> = {
    en: `⚠️ You already have *${existingLabel}* saved ${distance}m away.\n\nWould you like to update it to this new location?`,
    fr: `⚠️ Vous avez déjà *${existingLabel}* enregistré à ${distance}m.\n\nVoulez-vous le mettre à jour vers ce nouvel emplacement?`,
    rw: `⚠️ Usanzwe ufite *${existingLabel}* yabitswe kuri metero ${distance}.\n\nUrashaka kuyivugurura kuri iyi aderesi nshya?`,
  };
  return messages[locale] || messages.en;
}

export function getLocationSavedMessage(
  label: string,
  address: string,
  locale = "en"
): string {
  const messages: Record<string, string> = {
    en: `✅ *${label}* saved successfully!\n\n📍 ${address}\n\nYou can now use this location for quick bookings.`,
    fr: `✅ *${label}* enregistré avec succès!\n\n📍 ${address}\n\nVous pouvez maintenant utiliser ce lieu pour des réservations rapides.`,
    rw: `✅ *${label}* byabitswe neza!\n\n📍 ${address}\n\nUbu urashobora gukoresha aha hantu mu gutumiza byihuse.`,
  };
  return messages[locale] || messages.en;
}

export function getShareLocationPrompt(locale = "en", hasRecentLocation = false): string {
  if (hasRecentLocation) {
    // Include "Use Last Location" option
    const messages: Record<string, string> = {
      en: `📍 **Share Your Location**\n\nYou can:\n• Tap "📍 Use Last Location" button below\n• OR tap 📎 and select *Location* to share a new location\n• OR send an address`,
      fr: `📍 **Partagez Votre Position**\n\nVous pouvez:\n• Appuyez sur le bouton "📍 Utiliser la dernière position"\n• OU appuyez sur 📎 et sélectionnez *Position* pour partager une nouvelle position\n• OU envoyer une adresse`,
      rw: `📍 **Sangira Aho Uri**\n\nUrashobora:\n• Kanda "📍 Koresha aho wahereje" hasi\n• CYANGWA kanda 📎 hanyuma uhitemo *Aho uri* kugira ngo usangire aho ushya\n• CYANGWA wohereza aderesi`,
    };
    return messages[locale] || messages.en;
  }
  
  // No recent location - simple prompt
  const messages: Record<string, string> = {
    en: `📍 **Share Your Location**\n\nTap the 📎 button below and select *Location* to share where you are.\n\nOr send an address if you know it!`,
    fr: `📍 **Partagez Votre Position**\n\nAppuyez sur le bouton 📎 ci-dessous et sélectionnez *Position* pour partager où vous êtes.\n\nOu envoyez une adresse si vous la connaissez!`,
    rw: `📍 **Sangira Aho Uri**\n\nKanda buto ya 📎 hasi hanyuma uhitemo *Aho uri* kugira ngo usangire aho uri.\n\nCyangwa wohereza aderesi niba uyizi!`,
  };
  return messages[locale] || messages.en;
}

export function getUseLastLocationButton(locale = "en"): { id: string; title: string } {
  const buttons: Record<string, { id: string; title: string }> = {
    en: { id: "use_last_location", title: "📍 Use Last Location" },
    fr: { id: "use_last_location", title: "📍 Utiliser la dernière" },
    rw: { id: "use_last_location", title: "📍 Koresha aho wahereje" },
  };
  return buttons[locale] || buttons.en;
}

export function getLocationReusedMessage(ageMinutes: number, locale = "en"): string {
  const messages: Record<string, string> = {
    en: `✅ Using your location from ${ageMinutes} minute${ageMinutes === 1 ? '' : 's'} ago`,
    fr: `✅ Utilisation de votre position d'il y a ${ageMinutes} minute${ageMinutes === 1 ? '' : 's'}`,
    rw: `✅ Tukoresha aho wari ${ageMinutes === 1 ? 'umunota umwe' : `iminota ${ageMinutes}`} uhereye`,
  };
  return messages[locale] || messages.en;
}
