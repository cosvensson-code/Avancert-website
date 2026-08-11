# Avancert — Admin & Redaktørguide

## Hvad er dette?

Et simpelt inline-redigeringssystem. Teammedlemmer logger ind på `/login` og kan derefter klikke direkte på tekst på siden og redigere den. Ændringer gemmes i GitHub og er synlige på siden inden for 1–2 minutter.

---

## Første opsætning (én gang)

### 1. Vercel environment variables

Gå til **Vercel → Project → Settings → Environment Variables** og tilføj disse:

| Navn | Beskrivelse |
|---|---|
| `JWT_SECRET` | En lang tilfældig streng — bruges til at signere sessions-tokens. Fx `openssl rand -hex 32` i terminalen. |
| `USERS_JSON` | JSON-array med brugere (se format nedenfor). |
| `GITHUB_TOKEN` | Personal Access Token fra GitHub med `repo`-scope (læs + skriv). |
| `GITHUB_REPO` | `cosvensson-code/Avancert-website` |
| `GITHUB_BRANCH` | `main` |

---

### 2. Format for USERS_JSON

```json
[
  {
    "email": "ida@avancert.dk",
    "name": "Ida",
    "passwordHash": "$2a$10$..."
  }
]
```

**Sådan genererer du et password-hash:**

Kør dette i terminalen (Node.js skal være installeret):

```bash
node -e "const b=require('bcryptjs'); b.hash('dit-kodeord',10).then(h=>console.log(h))"
```

Kopier outputtet og indsæt som `passwordHash` i JSON.

**Tilføj en bruger:** Rediger `USERS_JSON` i Vercel og indsæt en ny bruger i arrayet. Ændringen træder i kraft ved næste request.

**Fjern en bruger:** Slet den pågældende entry fra `USERS_JSON` i Vercel.

---

### 3. GitHub Personal Access Token

1. Gå til **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens** (eller classic tokens med `repo`-scope).
2. Giv tokenet skriveadgang til `cosvensson-code/Avancert-website`.
3. Indsæt tokenet som `GITHUB_TOKEN` i Vercel.

---

## Daglig brug for redaktører

1. Gå til **avancert.dk/login**
2. Log ind med email og adgangskode
3. Klik på den tekst du vil ændre — en orange ramme viser, hvad der er redigerbart
4. Skriv den nye tekst
5. Klik **Gem ændringer** i den mørke bjælke øverst
6. Siden opdateres automatisk inden for 1–2 minutter

**Fortryd:** Klik "Fortryd" i bjælken — alle ugemte ændringer rulles tilbage.  
**Log ud:** Klik "Log ud" i bjælken.

---

## Redigerbare elementer

Følgende tekster kan redigeres direkte på siden:

**Hero:** Overskrift, fremhævet ord, brødtekst, tjek-punkter, knap-tekster  
**Navigation:** Alle menupunkter og header-telefonnummer  
**Kundeudtalelser:** Citater, navne og roller (3 kort)  
**Virksomheder vi har certificeret:** Eyebrow og overskrift  
**Om os:** Overskrift, brødtekster, USP-punkter (titler og beskrivelser)  
**Team:** Eyebrow og overskrift  
**Tilbud:** Eyebrow, overskrift, beskrivelse, prisfaktorer  
**FAQ:** Eyebrow og overskrift  
**CTA-sektion:** Eyebrow og overskrift  

---

## Tilføj nye redigerbare elementer

Find det relevante HTML-element i `index.html` og tilføj disse to attributter:

```html
<p data-editable data-key="et-unikt-navn">Teksten her</p>
```

- `data-editable` — markerer elementet som redigerbart
- `data-key` — unikt ID brugt til at finde elementet ved gemning (brug kun bogstaver, tal og bindestreger)

---

## Tilbagekald en ændring (rollback)

Alle redaktørgemninger laver et commit i GitHub med beskeden `Redaktør: Navn — dato/tid`.

1. Gå til `github.com/cosvensson-code/Avancert-website/commits/main`
2. Find committet du vil fortryde
3. Klik **Revert** — eller brug GitHub Desktop / git-kommandoen:
   ```bash
   git revert <commit-sha>
   git push
   ```

---

## Oprydning i images/

Når en redaktør vælger et nyt billede i editoren, uploader systemet filen til repoet med det samme — også selvom redaktøren aldrig trykker **Gem**. Over tid kan der derfor hobe sig ubrugte billedfiler op i `images/`-mappen.

**Symptom:** Filer med tidsstempel i navnet (`thomas-1786438497950.jpg` o.l.) er altid upload-rester.

**Sådan rydder du op:**

1. Klon repoet lokalt og åbn en terminal i rodmappen.
2. Find alle billedfiler, der *ikke* er refereret i nogen fil:
   ```bash
   for f in images/*; do
     grep -rl "$(basename $f)" . --include="*.html" --include="*.js" --include="*.md" | grep -q . || echo "UBRUGT: $f"
   done
   ```
3. Gennemgå listen og slet de filer, du er sikker på er ubrugte:
   ```bash
   git rm images/filnavn.jpg
   git commit -m "Ryd op: slet ubrugte billedfiler"
   git push
   ```

Husk: `banedanmark.webp` og alle andre aktive logoer og portræt­billeder **må ikke slettes**, selvom de muligvis ikke nævnes i selve HTML-koden (de kan bruges via editoren).

---

## Sikkerhed

- Adgangskoder gemmes aldrig i koden — kun bcrypt-hashes i Vercel env vars
- Sessions udløber efter 8 timer
- Kun `index.html` og `tilbudsinfo.html` kan redigeres via editoren
- GitHub-token og JWT-secret eksisterer udelukkende i Vercel — aldrig i git-historikken
