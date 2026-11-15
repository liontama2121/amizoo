# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Pinned by brief: HTML, CSS and vanilla JavaScript (no frameworks), mobile-first. Cloudflare Pages + Pages Functions (`/functions/api/...`), D1 (data), R2 (private files served via Function), Resend (email), Google Calendar as integration only. Phase 1 reads catalog data from `/api/*` with a static JSON fallback in `data/` (confirmed by user).

## Users

- Pet owners in north Bogotá and Sabana Norte (Cundinamarca) who need a vet at home — explicitly from "a señora de 80 años" to "un muchacho de 18". Many are not tech-savvy; they book on the phone.
- Small farm / production owners (bovinos, ovinos, caprinos, porcinos, aves) who need zootechnical advisory on site.
- AmiZoo admins (David Felipe Martínez López, Valentina Proaño Herrera) operating the panel from a phone between visits.

## Product Purpose

AmiZoo is a home-visit Veterinary Medicine and Zootechnics service. The site lets people understand services and prices, and request an appointment online (reviewed and confirmed by AmiZoo, never auto-confirmed), plus a client portal and admin panel. Success: a first-time visitor of any age books without calling.

## Positioning

Mobile, at-home care that joins companion-animal medicine with zootechnical advisory for production animals — the same team visits an apartment cat and a Sopó farm. No physical clinic. Does not attend emergencies.

## Operating Context

- Mon–Fri 8:00–18:00, no weekends or Colombian holidays, 24 h minimum notice, 50 min travel between visits, max ~5 visits/day, single shared calendar.
- $20.000 deposit to hold a booking (deducted from service), balance paid in cash/card at the visit.
- WhatsApp 314 230 0347 is the human fallback everywhere.

## Capabilities and Constraints

- Services, prices, durations, species, zones and plans are editable from the panel (D1).
- Vacunación and toma de muestras show "+ domicilio (te confirmamos el valor)"; the surcharge is never shown.
- Asesoría nutricional is virtual (no address step).
- Login is own email+password; never "Sign in with Google".
- Undecided: Nequi/Daviplata/transfer data, Hámster/Puma/Manatí membership prices, legal texts, team photos, official mascot illustration, coverage zone vs. "Calle 72 hacia el norte" conflict, domain (amizoovet).

## Brand Commitments

- Logos in `logo/` (vertical, horizontal, isotipo) are official and never modified.
- Colors only: turquesa `#73BEBD`, mango `#EAC72E` (primary); menta `#C8F9E1`, marfil `#F7F8F4`, grafito `#34363A` (support). No other colors.
- Type: Manrope (titles), Open Sans (text).
- Slogan: "Diferentes tamaños, misma importancia."
- Text always grafito on light grounds; turquoise/mango for fields, buttons, icons. Primary button: mango with grafito text.
- Mascot: an Australian budgerigar (green & yellow) named Amizoo; greets on first visit and flies to the bottom-right as the bot button.
- Liked references: dogtorblacky.com/servicios (UI), fronti.pet/pedircita (booking simplicity). Anti-reference: vetipass.com (generic, cluttered).
- Footer credit: "Hecho con amor por JuanCode".

## Evidence on Hand

- Five authorized testimonials (Cindy Ríos, Andrés Estupiñán, Valeria García, Juan Beltrán, Santiago Paredes) — verbatim in the brief.
- Full service table with prices, FAQ answers (19), mission/vision/values, team bios.
- Absent, must not be fabricated: photos of team or animals, membership prices, payment numbers, legal texts.

## Product Principles

1. One clear step at a time; the next action is always obvious and labeled in words.
2. Prices and conditions visible up front; no surprises at the door.
3. WhatsApp is always one tap away — the human is the safety net.
4. Every species matters equally ("Diferentes tamaños, misma importancia").
5. Honest about limits: no emergencies, coverage zones, pending confirmation.

## Accessibility & Inclusion

18 px base text, large titles, buttons ≥48 px with text labels, WCAG AA contrast, visible focus, full keyboard navigation, `alt` on every image, `prefers-reduced-motion` respected. Spanish (Colombia), timezone America/Bogota.
