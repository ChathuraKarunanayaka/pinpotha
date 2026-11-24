# දනට පින් ඇත්තෝ — පින් පොත

පින්කම් සඳහා මුදල් එකතු කිරීම, ගිණුම්, WhatsApp පණිවිඩ සහ බෙදාහැරීම කළමනාකරණය කරන සිංහල web app එකක්. සම්පූර්ණයෙන්ම නොමිලේ.

- **පිහිටුවීම** (එක් වරක්, විනාඩි 30ක් පමණ): [docs/SETUP.md](docs/SETUP.md)
- **භාවිතය**: app එකේ "තවත් → උදව්"

## ව්‍යුහය

| කොටස | තැන | වියදම |
|---|---|---|
| App (PWA, build නැත, libraries නැත) | `app/` → Vercel (`app/vercel.json`) | 0 |
| Backend (Google Apps Script) | `backend/Code.gs` | 0 |
| දත්ත | සංවිධානයේ Google Sheet එක | 0 |
| WhatsApp | `wa.me` links + දුරකථනයේ share | 0 |

දුරකථනය → (offline පෝලිම) → Apps Script → Google Sheet. දුරකථනය යවන්නේ වෙනස් වූ fields පමණි; server එක අවසර සහ නිවැරදි බව පරීක්ෂා කර, ඉතිහාසය ලියා, අනිත් දුරකථනවලට වෙනස්කම් දෙයි.

## වර්ධනය කිරීම

```
node tools/dev-server.mjs     # සැබෑ Code.gs එක, මතකයේ ඇති Sheet එකක් සමඟ. Link එක මුද්‍රණය වේ.
npm test                      # ගණනය කිරීම්, අවසර, sync tests
```

- **අලුත් field එකක්**: `Code.gs` හි `SCHEMA` + අදාළ form එකේ `fields`. ඉන්පසු Sheet මෙනුවෙන් "Sheet යාවත්කාලීන කරන්න".
- **අලුත් table එකක්**: `SCHEMA` + `authorize_` / `validate_` + `store.js` හි `TABLES`.
- **අලුත් තිරයක්**: `app/js/screens/` හි function එකක් + `main.js` හි `ROUTES` + `sw.js` හි ගොනු නම.
- **අලුත් පණිවිඩ වර්ගයක්**: `messages.js` හි `TEMPLATES` + `screens/messages.js` හි `QUEUES`.
- **2028 පොහොය දින**: `app/js/poya.js`.
- App එක වෙනස් කළ පසු `sw.js` හි `VERSION` වැඩි කරන්න.
