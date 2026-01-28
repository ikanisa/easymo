# Consent Message Templates v1

Standard templates for requesting call consent via WhatsApp.

## Request Consent — Client

### English
> To speed this up, I can place a quick WhatsApp call to clarify details.
> Do you allow me to call you for this request?
>
> Reply: **YES** or **NO**

### French
> Pour aller plus vite, je peux vous appeler sur WhatsApp pour clarifier.
> M'autorisez-vous à vous appeler pour cette demande ?
>
> Répondez: **OUI** ou **NON**

### Kinyarwanda
> Kugirango tugende vuba, nshobora kukuhamagara kuri WhatsApp.
> Wemera ko nguhmagara?
>
> Subiza: **YEGO** cyangwa **OYA**

---

## Request Consent — Vendor Call

### English
> I may need to call a vendor to confirm availability.
> Do you allow me to place calls on your behalf for this request?
>
> Reply: **YES** or **NO**

### French
> Je pourrais appeler un fournisseur pour confirmer la disponibilité.
> M'autorisez-vous à passer des appels pour cette demande ?
>
> Répondez: **OUI** ou **NON**

---

## Consent Granted Confirmation

### English
> Thanks! I may place a call if needed to speed things up.

### French
> Merci ! Je pourrai appeler si nécessaire pour accélérer les choses.

### Kinyarwanda
> Murakoze! Nshobora guhamagara iyo bikenewe.

---

## Consent Denied Confirmation

### English
> No problem. I'll continue via chat only.

### French
> Pas de souci. Je continue uniquement par chat.

### Kinyarwanda
> Nta kibazo. Nkomeza ubutumwa gusa.

---

## Call Fallback (on failure)

### English
> The call didn't go through. I'll continue via chat.

### French
> L'appel n'a pas abouti. Je continue par chat.

### Kinyarwanda
> Telefoni ntiyakunda. Nkomeza ubutumwa.

---

## Affirmative Patterns (for parsing)
- English: `yes`, `yeah`, `yep`, `ok`, `sure`, `yes please`, `go ahead`
- French: `oui`, `d'accord`, `ok`, `ouais`, `vas-y`
- Kinyarwanda: `yego`, `ego`, `ni byiza`

## Negative Patterns (for parsing)
- English: `no`, `nope`, `no thanks`, `don't call`, `not now`
- French: `non`, `pas maintenant`, `ne m'appelez pas`
- Kinyarwanda: `oya`, `reka`
