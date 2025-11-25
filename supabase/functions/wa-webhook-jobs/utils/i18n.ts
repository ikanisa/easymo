// Simple i18n translations for jobs microservice
// Full i18n will be handled by shared package in future

const translations: Record<string, Record<string, string>> = {
  en: {
    "jobs.menu.greeting": "Welcome to EasyMO Jobs! 💼\n\nFind your dream job or post opportunities.",
    "jobs.menu.button": "Select Option",
    "jobs.menu.section": "Job Board Options",
    "jobs.menu.find.title": "🔍 Find Jobs",
    "jobs.menu.find.description": "Search for job opportunities",
    "jobs.menu.post.title": "📝 Post a Job",
    "jobs.menu.post.description": "Hire talented professionals",
    "jobs.menu.myApplications.title": "📋 My Applications",
    "jobs.menu.myApplications.description": "View your job applications",
    "jobs.menu.myJobs.title": "💼 My Posted Jobs",
    "jobs.menu.myJobs.description": "Manage your job postings",
    "jobs.seeker.welcome": "Let's find you the perfect job! 🎯\n\nTell me what kind of work you're looking for.",
    "jobs.poster.welcome": "Great! Let's post your job opportunity. 📝\n\nWhat position are you hiring for?",
    "jobs.applications.header": "📋 *My Applications*",
    "jobs.applications.empty": "📋 *My Applications*\n\nYou haven't applied to any jobs yet. Reply '1' to search for jobs!",
    "jobs.applications.noProfile": "You haven't created a job seeker profile yet. Reply with your skills to get started!",
    "jobs.applications.error": "Sorry, I couldn't fetch your applications. Please try again.",
    "jobs.myJobs.header": "💼 *My Posted Jobs*",
    "jobs.myJobs.empty": "💼 *My Posted Jobs*\n\nYou haven't posted any jobs yet. Reply '2' to post a job!",
    "jobs.myJobs.error": "Sorry, I couldn't fetch your jobs. Please try again.",
    "jobs.agent.error": "I couldn't process that request.",
    
    // Job application translations
    "jobs.apply.prompt.cover_message": "📝 *Apply to: {{title}}*\n\nTell the employer why you're a good fit for this role.\n\nYour message will be sent directly to them.",
    "jobs.apply.success": "✅ *Application Submitted!*\n\nYour application for *{{title}}* has been sent to the employer.\n\nThey will contact you if interested. Good luck! 🍀",
    "jobs.apply.error.already_applied": "ℹ️ You've already applied to this job.\n\nThe employer has your application.",
    "jobs.apply.error.self_application": "⚠️ You cannot apply to your own job posting.",
    "jobs.apply.error.job_not_found": "❌ This job is no longer available.",
    "jobs.apply.error.message_required": "Please write a message to the employer explaining why you're interested in this job.",
    "jobs.apply.error.submission_failed": "❌ Failed to submit your application. Please try again.",
    "jobs.apply.employer_notification": "🔔 *New Application!*\n\nSomeone applied to: *{{title}}*\n\n👤 Applicant: {{phone}}\n\n💬 Message:\n\"{{message}}\"\n\nView all applications: Reply 'MY JOBS'",
    "jobs.applications.empty": "📋 *My Applications*\n\nYou haven't applied to any jobs yet.\n\nTap 'Find Jobs' to search for opportunities!",
    "jobs.applications.list": "📋 *Your Applications*\n\n{{applications}}\n\n⏳ Pending | 👁️ Reviewed | ✅ Accepted | ❌ Rejected",
    
    // Seeker onboarding translations
    "jobs.seeker.onboarding.skills_prompt": "💼 *Let's set up your job seeker profile!*\n\nWhat are your key skills?\n\nExamples:\n• Driver, Mechanic\n• Cook, Waiter\n• Security Guard\n• IT Support, Data Entry\n\nSeparate multiple skills with commas.",
    "jobs.seeker.onboarding.locations_prompt": "📍 *Great! Now your preferred work locations...*\n\nWhich areas do you prefer to work in?\n\nExamples:\n• Kigali, Nyarugenge\n• Kimironko, Remera\n• Anywhere in Kigali\n\nSeparate multiple locations with commas.",
    "jobs.seeker.onboarding.experience_prompt": "📊 *Almost done!*\n\nHow many years of work experience do you have?\n\nJust enter a number:\n• 0 (for fresh graduate)\n• 2 (for 2 years)\n• 5+ (for 5 or more years)",
    "jobs.seeker.onboarding.success": "✅ *Profile Created!*\n\n💼 Skills: {{skills}}\n📍 Preferred Areas: {{locations}}\n📊 Experience: {{years}} years\n\nYou can now apply for jobs!\n\nLet's find you the perfect opportunity! 🎯",
    "jobs.seeker.onboarding.empty_input": "Please provide a response to continue.",
    "jobs.seeker.onboarding.skills_invalid": "Please enter at least one skill (e.g., Driver, Cook, Security).",
    "jobs.seeker.onboarding.locations_invalid": "Please enter at least one location (e.g., Kigali, Nyarugenge).",
    "jobs.seeker.onboarding.experience_invalid": "Please enter a valid number of years (0-50).",
    "jobs.seeker.onboarding.creation_failed": "Failed to create your profile. Please try again.",
  },
  fr: {
    "jobs.menu.greeting": "Bienvenue sur EasyMO Jobs! 💼\n\nTrouvez l'emploi de vos rêves ou publiez des opportunités.",
    "jobs.menu.button": "Sélectionner",
    "jobs.menu.section": "Options du tableau d'emploi",
    "jobs.menu.find.title": "🔍 Trouver des emplois",
    "jobs.menu.find.description": "Rechercher des opportunités",
    "jobs.menu.post.title": "📝 Publier une offre",
    "jobs.menu.post.description": "Embaucher des professionnels",
    "jobs.menu.myApplications.title": "📋 Mes candidatures",
    "jobs.menu.myApplications.description": "Voir vos candidatures",
    "jobs.menu.myJobs.title": "💼 Mes offres publiées",
    "jobs.menu.myJobs.description": "Gérer vos offres d'emploi",
    "jobs.seeker.welcome": "Trouvons-vous l'emploi parfait! 🎯\n\nDites-moi quel type de travail vous recherchez.",
    "jobs.poster.welcome": "Parfait! Publions votre offre d'emploi. 📝\n\nQuel poste recrutez-vous?",
    "jobs.applications.header": "📋 *Mes Candidatures*",
    "jobs.applications.empty": "📋 *Mes Candidatures*\n\nVous n'avez pas encore postulé. Répondez '1' pour chercher des emplois!",
    "jobs.applications.noProfile": "Vous n'avez pas encore créé de profil. Répondez avec vos compétences pour commencer!",
    "jobs.applications.error": "Désolé, je n'ai pas pu récupérer vos candidatures. Veuillez réessayer.",
    "jobs.myJobs.header": "💼 *Mes Offres*",
    "jobs.myJobs.empty": "💼 *Mes Offres*\n\nVous n'avez pas encore publié d'offres. Répondez '2' pour publier!",
    "jobs.myJobs.error": "Désolé, je n'ai pas pu récupérer vos offres. Veuillez réessayer.",
    "jobs.agent.error": "Je n'ai pas pu traiter cette demande.",
    
    // Job application translations (French)
    "jobs.apply.prompt.cover_message": "📝 *Postuler à: {{title}}*\n\nExpliquez à l'employeur pourquoi vous êtes un bon candidat.\n\nVotre message lui sera envoyé directement.",
    "jobs.apply.success": "✅ *Candidature Envoyée!*\n\nVotre candidature pour *{{title}}* a été envoyée.\n\nL'employeur vous contactera s'il est intéressé. Bonne chance! 🍀",
    "jobs.apply.error.already_applied": "ℹ️ Vous avez déjà postulé à cette offre.\n\nL'employeur a votre candidature.",
    "jobs.apply.error.self_application": "⚠️ Vous ne pouvez pas postuler à votre propre offre.",
    "jobs.apply.error.job_not_found": "❌ Cette offre n'est plus disponible.",
    "jobs.apply.error.message_required": "Veuillez écrire un message pour expliquer votre intérêt.",
    "jobs.apply.error.submission_failed": "❌ Échec de l'envoi. Veuillez réessayer.",
    "jobs.apply.employer_notification": "🔔 *Nouvelle Candidature!*\n\nQuelqu'un a postulé à: *{{title}}*\n\n👤 Candidat: {{phone}}\n\n💬 Message:\n\"{{message}}\"\n\nVoir les candidatures: Répondez 'MES OFFRES'",
    "jobs.applications.empty": "📋 *Mes Candidatures*\n\nVous n'avez pas encore postulé.\n\nAppuyez sur 'Trouver des emplois'!",
    "jobs.applications.list": "📋 *Vos Candidatures*\n\n{{applications}}\n\n⏳ En attente | 👁️ Vue | ✅ Acceptée | ❌ Rejetée",
    "jobs.seeker.onboarding.skills_prompt": "💼 *Créons votre profil!*\n\nQuelles sont vos compétences?\n\nExemples:\n• Chauffeur, Mécanicien\n• Cuisinier, Serveur\n• Agent de sécurité\n• Support IT\n\nSéparez avec des virgules.",
    "jobs.seeker.onboarding.locations_prompt": "📍 *Parfait! Vos zones préférées...*\n\nOù préférez-vous travailler?\n\nExemples:\n• Kigali, Nyarugenge\n• Kimironko, Remera\n\nSéparez avec des virgules.",
    "jobs.seeker.onboarding.experience_prompt": "📊 *Presque fini!*\n\nCombien d'années d'expérience avez-vous?\n\nEntrez un nombre:\n• 0 (débutant)\n• 2 (2 ans)\n• 5+ (5 ans ou plus)",
    "jobs.seeker.onboarding.success": "✅ *Profil Créé!*\n\n💼 Compétences: {{skills}}\n📍 Zones: {{locations}}\n📊 Expérience: {{years}} ans\n\nVous pouvez maintenant postuler! 🎯",
    "jobs.seeker.onboarding.empty_input": "Veuillez fournir une réponse.",
    "jobs.seeker.onboarding.skills_invalid": "Entrez au moins une compétence.",
    "jobs.seeker.onboarding.locations_invalid": "Entrez au moins un lieu.",
    "jobs.seeker.onboarding.experience_invalid": "Entrez un nombre valide (0-50).",
    "jobs.seeker.onboarding.creation_failed": "Échec de création. Réessayez.",
  },
  rw: {
    "jobs.menu.greeting": "Murakaza neza kuri EasyMO Jobs! 💼\n\nShaka akazi cyiza cyangwa utangaze imirimo.",
    "jobs.menu.button": "Hitamo",
    "jobs.menu.section": "Amahitamo y'akazi",
    "jobs.menu.find.title": "🔍 Shakisha Akazi",
    "jobs.menu.find.description": "Shakisha amahirwe y'akazi",
    "jobs.menu.post.title": "📝 Tanga Akazi",
    "jobs.menu.post.description": "Shakisha abakozi",
    "jobs.menu.myApplications.title": "📋 Ibyansabye",
    "jobs.menu.myApplications.description": "Reba ibyansabye byawe",
    "jobs.menu.myJobs.title": "💼 Imirimo yanjye",
    "jobs.menu.myJobs.description": "Gucunga imirimo wakoze",
    "jobs.seeker.welcome": "Reka turebe akazi gakwiye! 🎯\n\nMbwira ubwoko bw'akazi ushaka.",
    "jobs.poster.welcome": "Ni byiza! Reka dutangaze akazi kawe. 📝\n\nNi iyihe mirimo urashaka?",
    "jobs.applications.header": "📋 *Ibyansabye Byanjye*",
    "jobs.applications.empty": "📋 *Ibyansabye Byanjye*\n\nNtabwo wasabye akazi. Subiza '1' gushaka akazi!",
    "jobs.applications.noProfile": "Ntabwo ufite umwirondoro. Subiza n'ubumenyi bwawe gutangira!",
    "jobs.applications.error": "Mbabarira, sinashobora kubona ibyansabye byawe. Ongera ugerageze.",
    "jobs.myJobs.header": "💼 *Imirimo Yanjye*",
    "jobs.myJobs.empty": "💼 *Imirimo Yanjye*\n\nNtabwo watanze imirimo. Subiza '2' gutanga akazi!",
    "jobs.myJobs.error": "Mbabarira, sinashobora kubona imirimo yawe. Ongera ugerageze.",
    "jobs.agent.error": "Sinashobora gukora icyo wasabye.",
    
    // Job application translations (Kinyarwanda)
    "jobs.apply.prompt.cover_message": "📝 *Gusaba: {{title}}*\n\nBwira umukoresha impamvu ukwiye kuba mwasabwa aka kazi.\n\nUbutumwa bwawe buzamuboherezwa.",
    "jobs.apply.success": "✅ *Icyifuzo Cyoherejwe!*\n\nIcyifuzo cyawe cyo *{{title}}* cyoherejwe.\n\nUmukoresha azakuvugisha niba ashishikajwe. Amahirwe! 🍀",
    "jobs.apply.error.already_applied": "ℹ️ Wamaze gusaba aka kazi.\n\nUmukoresha afite icyifuzo cyawe.",
    "jobs.apply.error.self_application": "⚠️ Ntushobora gusaba akazi wakoze.",
    "jobs.apply.error.job_not_found": "❌ Aka kazi ntakaboneka.",
    "jobs.apply.error.message_required": "Nyamuneka wandika ubutumwa.",
    "jobs.apply.error.submission_failed": "❌ Byanze kohereza. Ongera ugerageze.",
    "jobs.apply.employer_notification": "🔔 *Icyifuzo Gishya!*\n\nUmuntu yasabye: *{{title}}*\n\n👤 Usaba: {{phone}}\n\n💬 Ubutumwa:\n\"{{message}}\"\n\nReba ibyasabwe: Subiza 'IMIRIMO YANJYE'",
    "jobs.applications.empty": "📋 *Ibyasabwe Byanjye*\n\nNtabwo wasabye akazi.\n\nKanda 'Shakisha Akazi'!",
    "jobs.applications.list": "📋 *Ibyasabwe Byawe*\n\n{{applications}}\n\n⏳ Bitegerejwe | 👁️ Byarebwe | ✅ Byemewe | ❌ Byanze",
    "jobs.seeker.onboarding.skills_prompt": "💼 *Reka dukore umwirondoro wawe!*\n\nNi ubuhe bumenyi ufite?\n\nIngero:\n• Umushoferi, Mekanikiye\n• Umutetsi, Umukorera\n• Umukozi wa IT\n\nVamo utandukanya n'akabago.",
    "jobs.seeker.onboarding.locations_prompt": "📍 *Ni byiza! Ahantu ukunda...*\n\nNi hehe ukunda gukorera?\n\nIngero:\n• Kigali, Nyarugenge\n• Kimironko, Remera\n\nVamo utandukanya n'akabago.",
    "jobs.seeker.onboarding.experience_prompt": "📊 *Hafi byarangiye!*\n\nUfite imyaka ingahe y'uburambe?\n\nAndika umubare:\n• 0 (nshya)\n• 2 (imyaka 2)\n• 5+ (5 cyangwa irenga)",
    "jobs.seeker.onboarding.success": "✅ *Umwirondoro Waremwe!*\n\n💼 Ubumenyi: {{skills}}\n📍 Uturere: {{locations}}\n📊 Uburambe: Imyaka {{years}}\n\nUbu ushobora gusaba akazi! 🎯",
    "jobs.seeker.onboarding.empty_input": "Nyamuneka tanga igisubizo.",
    "jobs.seeker.onboarding.skills_invalid": "Andika byibura ubumenyi bumwe.",
    "jobs.seeker.onboarding.locations_invalid": "Andika byibura ahantu hamwe.",
    "jobs.seeker.onboarding.experience_invalid": "Andika umubare wemewe (0-50).",
    "jobs.seeker.onboarding.creation_failed": "Byanze gukora. Ongera ugerageze.",
  },
};

export function t(locale: string, key: string, params?: Record<string, string>): string {
  const lang = locale.split("-")[0] || "en";
  let text = translations[lang]?.[key] || translations.en[key] || key;
  
  // Replace template parameters {{param}}
  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), value);
    });
  }
  
  return text;
}
