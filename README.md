# 📚 Βιβλιοθήκη — Προσωπική Ψηφιακή Βιβλιοθήκη

Μια ιστοσελίδα βιβλιοθήκης σε στυλ Apple Books, που εμφανίζει αυτόματα όλα τα PDF βιβλία σου οργανωμένα ανά τάξη. Το εξώφυλλο κάθε βιβλίου παράγεται αυτόματα από την πρώτη σελίδα του PDF.

---

## 📁 Δομή φακέλων

```
vivliothiki/
├── index.html          ← Η κύρια σελίδα
├── config.js           ← ΕΔΩ βάζεις τα στοιχεία σου
├── assets/
│   ├── css/style.css
│   └── js/app.js
├── A_Gymnasiou/        ← Βάλε εδώ τα PDF Α' Γυμνασίου
├── B_Gymnasiou/        ← Βάλε εδώ τα PDF Β' Γυμνασίου
├── C_Gymnasiou/        ← Βάλε εδώ τα PDF Γ' Γυμνασίου
├── A_Lykeiou/          ← Βάλε εδώ τα PDF Α' Λυκείου
├── B_Lykeiou/          ← Βάλε εδώ τα PDF Β' Λυκείου
└── C_Lykeiou/          ← Βάλε εδώ τα PDF Γ' Λυκείου
```

---

## 🚀 Οδηγίες εγκατάστασης

### Βήμα 1 — Δημιούργησε νέο GitHub Repository

1. Πήγαινε στο [github.com](https://github.com) και κάνε σύνδεση
2. Κάνε κλικ στο **"+"** → **New repository**
3. Δώσε ένα όνομα (π.χ. `vivliothiki-mou`)
4. Επίλεξε **Public** (ή Private αν χρησιμοποιείς Token)
5. Κάνε κλικ **Create repository**

### Βήμα 2 — Ρύθμισε το config.js

Άνοιξε το αρχείο `config.js` και συμπλήρωσε:

```javascript
const CONFIG = {
  githubUser:   'το_username_σου',      // ← άλλαξε αυτό
  githubRepo:   'vivliothiki-mou',       // ← άλλαξε αυτό
  githubBranch: 'main',
  githubToken:  '',                      // ← προαιρετικό
};
```

### Βήμα 3 — Ανέβασε τα αρχεία στο GitHub

**Επιλογή Α — Από τον browser (απλό):**
1. Άνοιξε το repository σου στο GitHub
2. Κάνε κλικ **"Add file"** → **"Upload files"**
3. Σύρε και άφησε ΟΛΑ τα αρχεία (index.html, config.js, assets/, φακέλους τάξεων)
4. Κάνε κλικ **"Commit changes"**

**Επιλογή Β — Με Git (για πιο προχωρημένους):**
```bash
git init
git add .
git commit -m "Αρχική βιβλιοθήκη"
git remote add origin https://github.com/username/repo.git
git push -u origin main
```

### Βήμα 4 — Ενεργοποίησε το GitHub Pages

1. Πήγαινε στο repository σου → **Settings**
2. Αριστερό μενού → **Pages**
3. Στο **"Branch"** επίλεξε `main` και φάκελο `/ (root)`
4. Κάνε κλικ **Save**
5. Μετά από 1-2 λεπτά η σελίδα είναι διαθέσιμη στο:
   `https://username.github.io/repo-name/`

---

## 📖 Πώς να προσθέσεις βιβλία

1. Άνοιξε το repository σου στο GitHub
2. Κάνε κλικ στον φάκελο της τάξης (π.χ. `B_Gymnasiou`)
3. Κάνε κλικ **"Add file"** → **"Upload files"**
4. Ανέβασε το PDF (π.χ. `Μαθηματικά_Β_Γυμνασίου.pdf`)
5. Κάνε κλικ **"Commit changes"**

Το εξώφυλλο παράγεται αυτόματα από την **1η σελίδα** του PDF!

---

## 💡 Χρήσιμες συμβουλές

- **Ονομασία αρχείων:** Χρησιμοποίησε underscores αντί για κενά
  (π.χ. `Φυσική_Β_Λυκείου.pdf`)
- **Rate limit:** Αν εμφανιστεί σφάλμα 403, πρόσθεσε ένα GitHub Personal Access Token στο `config.js`
- **Private repo:** Απαιτείται Token για private repositories
- **Αναζήτηση:** Πάτα `/` για να εστιάσεις στο πεδίο αναζήτησης

---

## 🌐 Απαιτήσεις

- Δωρεάν λογαριασμός GitHub
- Public repository (ή Private με Token)
- GitHub Pages ενεργοποιημένο

Δεν χρειάζεται server, database ή πληρωμή!
