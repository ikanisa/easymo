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
  },
};

export function t(locale: string, key: string): string {
  const lang = locale.split("-")[0] || "en";
  return translations[lang]?.[key] || translations.en[key] || key;
}
