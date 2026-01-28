# OCR Client Messages v1

## Processing Acknowledgment

### English
```
🔍 Processing your image... I'll let you know what I find.
```

### French
```
🔍 Analyse de votre image en cours... Je vous tiendrai informé.
```

### Kinyarwanda
```
🔍 Ndimo gusesengura ifoto yawe... Nzakumenyesha ibyo nabonye.
```

---

## Clarification Requests

### Uncertain Drug Name (Medical)

**English:**
```
I couldn't read the medication name clearly. Could you please:
1. Confirm if this is correct: "[extracted_value]"
2. Or type the medication name for me
```

**French:**
```
Je n'ai pas pu lire clairement le nom du médicament. Pourriez-vous:
1. Confirmer si c'est correct: "[extracted_value]"
2. Ou taper le nom du médicament
```

### Uncertain Dose

**English:**
```
I'm not sure about the dosage: "[extracted_value]"
Can you confirm or correct it?
```

**French:**
```
Je ne suis pas sûr du dosage: "[extracted_value]"
Pouvez-vous confirmer ou corriger?
```

### General Uncertainty

**English:**
```
I extracted some details but need clarification on: [field_list]
Can you help me confirm these details?
```

**French:**
```
J'ai extrait quelques détails mais j'ai besoin de clarification sur: [field_list]
Pouvez-vous m'aider à confirmer ces détails?
```

---

## Failure Messages

### Unreadable Image

**English:**
```
😔 I couldn't read the image clearly. Could you please:
- Resend with better lighting
- Make sure the text is in focus
- Try a closer photo if the text is small
```

**French:**
```
😔 Je n'ai pas pu lire l'image clairement. Pourriez-vous:
- Renvoyer avec un meilleur éclairage
- S'assurer que le texte est net
- Essayer une photo plus proche si le texte est petit
```

### Processing Failed

**English:**
```
Sorry, I had trouble processing that image. Please try sending it again.
```

**French:**
```
Désolé, j'ai eu des difficultés à traiter cette image. Veuillez la renvoyer.
```

---

## Success Confirmation

### Prescription Extracted

**English:**
```
✅ Got it! I found the following medications:
[item_list]

I'll now search for available options from pharmacies near you.
```

**French:**
```
✅ C'est noté! J'ai trouvé les médicaments suivants:
[item_list]

Je vais maintenant chercher les options disponibles dans les pharmacies près de chez vous.
```

### General Product Extracted

**English:**
```
✅ I understand you're looking for: [product_summary]

Let me find the best options for you.
```

**French:**
```
✅ Je comprends que vous cherchez: [product_summary]

Laissez-moi trouver les meilleures options pour vous.
```
