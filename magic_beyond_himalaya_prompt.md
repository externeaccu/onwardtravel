# Prompt: Magic Beyond Himalaya -- Website Design

Paste everything below the line into a new Claude conversation.

---

You are a website designer specialising in adventure travel and trekking agencies. Design and build a **single-page website** as one self-contained HTML file (HTML + CSS + JS, no frameworks) for a Nepal-based trekking company. The file will be deployed via Netlify drag-and-drop, so it must work standalone with no build step.

## Brand & Business

**Company:** Magic Beyond Himalaya
**Founded:** 2017
**Owner/Lead Guide:** Sandip -- a Nepali local guide based near Kathmandu
**Tagline:** "Every step tells a story"
**Mission:** Authentic, guide-led Himalayan treks that support local communities and connect travellers to culture, not just scenery.
**Email:** magicbeyondhimalaya@gmail.com
**Phone / WhatsApp:** +977 9851353347
**Google Maps:** https://maps.app.goo.gl/V1rbKJxa65syVGEUA

## Design Direction

**Vibe: Warm, personal, guide-led.** This is NOT a luxury resort brand. This is a real local guide who knows these mountains personally. The site should feel trustworthy, authentic, and human -- like getting a recommendation from a friend who lives there. Think: rich photography, warm earth tones, clean typography, generous whitespace. The design should be high quality without feeling corporate or out of reach.

**Design principles:**
- Mobile-first. Most of Sandip's clients find him via WhatsApp or social media and browse on their phones
- High trust signals: reviews, personal story, clear pricing, no hidden costs
- Aspirational but accessible -- these treks cost $150-600, targeting backpackers and mid-budget adventurers, not luxury tourists
- Photography-led with large hero images (use placeholder images via picsum.photos or similar, sized appropriately -- the client will replace these with real trek photos)
- Sticky WhatsApp button in bottom-right corner on all screen sizes

**Colour palette suggestion (adjust if you have a better idea):**
- Deep forest green or slate blue as primary
- Warm amber/gold as accent
- Off-white / warm cream backgrounds
- Dark charcoal for text (not pure black)

**Typography:** Use Google Fonts. Something with character but highly readable -- e.g. a serif or semi-serif for headings (like Playfair Display, Lora, or DM Serif Display), paired with a clean sans-serif for body (like Inter, DM Sans, or Source Sans 3).

## Page Structure (single page, scroll-based)

### 1. Hero Section
- Full-width background image (placeholder) of Himalayan landscape
- Company name "Magic Beyond Himalaya" and tagline
- Brief one-liner: "Guided treks through Nepal's most breathtaking landscapes since 2017"
- Two CTA buttons: "Explore Treks" (scrolls down) and "Contact Us on WhatsApp" (opens WhatsApp with prefilled message)

### 2. About Section
- Short personal intro about Sandip and the company -- keep it warm, first-person feel
- Use this source text (rewrite for the web -- make it concise and compelling):

> "Since 2017, we have been guiding travelers through the awe-inspiring landscapes of the Himalayas, offering more than just a trek -- an enriching journey into the region's vibrant culture, traditions, and spiritual heritage. As experienced local guides, we take pride in crafting immersive experiences that connect you with the heart and soul of the mountains. We are dedicated to supporting and empowering local guides from diverse Himalayan regions, ensuring that your adventure is not only authentic but also contributes to sustainable livelihoods."

- Include trust badges / key stats: "Since 2017", "Local Nepali guides", "X+ treks completed", "All permits included"

### 3. Trek Catalogue -- "Our Treks"
Display all 6 treks as visually appealing cards. Each card shows:
- Trek name
- Hero image (placeholder)
- Duration (days)
- Difficulty badge (Easy / Moderate / Challenging / Strenuous)
- Max altitude
- Starting price ("From $XXX per person")
- "View Details" button that expands an accordion or opens a modal

**When expanded/opened, each trek shows:**
- Overview paragraph
- Day-by-day itinerary (collapsible)
- Price table by group size
- What's included vs not included (two-column or tabs)
- Best season
- Key highlights (3-5 bullets max)
- "Book This Trek" button (WhatsApp link with prefilled message: "Hi, I'm interested in the [Trek Name]. Could you share available dates?")

**The 6 treks (all data below must be used):**

---

#### Trek 1: Ghorepani Poon Hill Trek
- **Duration:** 4 days
- **Difficulty:** Easy to Moderate
- **Max altitude:** 3,210m (Poon Hill)
- **Best season:** Spring (Mar-May), Autumn (Sep-Nov)
- **Overview:** A short trek in Nepal's Annapurna region famed for its breathtaking sunrise views over the Himalayas. The vantage point offers panoramic sights of Dhaulagiri, Annapurna, and Machhapuchhre. Passes through lush rhododendron forests, charming villages, and terraced fields.

**Itinerary:**
- Day 1: Drive Pokhara to Nayapul, trek to Ulleri (2,050m) -- 5-6 hrs
- Day 2: Trek to Ghorepani (2,860m) -- 5-6 hrs
- Day 3: Sunrise hike to Poon Hill (3,210m), trek to Tadapani (2,630m) -- 6-7 hrs
- Day 4: Trek to Ghandruk, drive to Pokhara -- 4-5 hrs + 2 hr drive

**Pricing (per person):**
| Group Size | Price |
|---|---|
| 1 pax | $300 |
| 2 pax | $225 |
| 4 pax | $200 |
| 6 pax | $180 |
| 8 pax | $165 |
| 9+ pax | $150 |

**Key highlights:** Poon Hill sunrise over 20+ peaks, rhododendron forests, Gurung village cultural immersion, low altitude sickness risk, suitable for beginners and families.

---

#### Trek 2: Langtang Valley Trek
- **Duration:** 7 days (6 nights)
- **Difficulty:** Moderate
- **Max altitude:** 4,773m (Kyanjin Ri) / optionally 5,030m (Tserko Ri)
- **Best season:** Spring (Mar-May), Autumn (Sep-Nov)
- **Overview:** Ideal for those with limited time seeking Himalayan vistas, cultural immersion, and diverse landscapes. Features rhododendron forests, Tamang villages, glaciers, and panoramic views of Langtang Lirung (7,246m).

**Itinerary:**
- Day 1: Drive Kathmandu to Syabrubesi (1,460m) -- 6-7 hrs
- Day 2: Trek to Lama Hotel (2,470m) -- 5-6 hrs
- Day 3: Trek to Langtang Village (3,500m)
- Day 4: Trek to Kyanjin Gompa (3,800m) -- 4-5 hrs
- Day 5: Hike Kyanjin Ri (4,773m) or Tserko Ri (5,030m), descend to Lama Hotel -- 6-7 hrs
- Day 6: Trek to Syabrubesi (1,470m) -- 5-6 hrs
- Day 7: Drive back to Kathmandu -- 6-7 hrs

**Pricing (per person):**
| Group Size | Price |
|---|---|
| 1 pax | $325 |
| 2 pax | $250 |
| 4 pax | $225 |
| 6 pax | $200 |
| 8 pax | $175 |
| 9+ pax | $150 |

**Key highlights:** Fewer crowds than Everest/Annapurna, 360-degree sunrise panoramas, Kyanjin Gompa monastery, Tamang cultural heritage, Langtang National Park wildlife.

---

#### Trek 3: Annapurna Circuit with Tilicho Lake
- **Duration:** 11 days
- **Difficulty:** Challenging to Strenuous
- **Max altitude:** 5,416m (Thorong La Pass)
- **Best season:** Spring (Mar-May), Autumn (Sep-Nov)
- **Overview:** A comprehensive circuit combining the classic Annapurna trek with a detour to Tilicho Lake (4,919m), one of the world's highest lakes. Crosses the iconic Thorong La Pass and descends to the sacred Muktinath Temple.

**Itinerary:**
- Day 1: Drive to Dharapani (1,860m) -- 8-10 hrs
- Day 2: Trek to Chame (2,710m) -- 5-6 hrs
- Day 3: Trek to Upper Pisang (3,300m) -- 5-6 hrs
- Day 4: Trek to Manang (3,540m) -- 4-5 hrs
- Day 5: Acclimatization in Manang
- Day 6: Trek to Tilicho Base Camp (4,150m) -- 7-8 hrs
- Day 7: Hike to Tilicho Lake (4,919m), return to Siri Kharka -- 7-8 hrs
- Day 8: Trek to Yak Kharka (4,060m) -- 5 hrs
- Day 9: Trek to Thorong High Camp (4,880m) -- 4-5 hrs
- Day 10: Cross Thorong La Pass (5,416m) to Muktinath (3,760m) -- 8-10 hrs
- Day 11: Drive to Pokhara -- 9-10 hrs

**Pricing (per person):**
| Group Size | Price |
|---|---|
| 1 pax | $490 |
| 2 pax | $350 |
| 4 pax | $300 |
| 6 pax | $275 |
| 8 pax | $250 |
| 9+ pax | $225 |

**Key highlights:** Tilicho Lake turquoise glacial waters, Thorong La Pass crossing, Muktinath Temple, diverse ecosystems from jungle to glacier, Tibetan-influenced villages.

---

#### Trek 4: Annapurna Base Camp with Ghorepani Poon Hill
- **Duration:** 8 days
- **Difficulty:** Moderate to Challenging
- **Max altitude:** 4,130m (ABC)
- **Best season:** Spring (Mar-May), Autumn (Sep-Nov)
- **Overview:** Combines the iconic Annapurna Sanctuary -- a glacial amphitheatre surrounded by 8,000m peaks -- with the classic Poon Hill sunrise experience. A complete Annapurna experience in just over a week.

**Itinerary:**
- Day 1: Drive Pokhara to Tikhedhunga, trek to Ulleri (2,050m) -- 2-3 hrs
- Day 2: Trek to Ghorepani (2,870m) -- 5-6 hrs
- Day 3: Poon Hill sunrise hike, trek to Tadapani (2,600m) -- 7-8 hrs
- Day 4: Trek to Sinuwa (2,340m) -- 6-7 hrs
- Day 5: Trek to Deurali (3,230m) -- 5-6 hrs
- Day 6: Trek to ABC (4,130m) via MBC (3,700m) -- 6-7 hrs
- Day 7: Trek to Bamboo -- 7-8 hrs
- Day 8: Trek to Jhinu Danda (1,760m), drive to Pokhara -- 4 hrs trek

**Pricing (per person):**
| Group Size | Price |
|---|---|
| 1 pax | $400 |
| 2 pax | $280 |
| 4 pax | $230 |
| 6 pax | $200 |
| 8 pax | $185 |
| 9+ pax | $170 |

**Key highlights:** 360-degree views from Annapurna Sanctuary, Machhapuchhre (Fishtail) up close, Poon Hill sunrise, Jhinu hot springs, rhododendron forests.

---

#### Trek 5: Manaslu + Tsum Valley Trek
- **Duration:** 18 days
- **Difficulty:** Challenging to Strenuous
- **Max altitude:** 5,106m (Larkya La Pass)
- **Best season:** Spring (Mar-May), Autumn (Sep-Nov)
- **Overview:** A remote 18-day journey combining the sacred Tsum Valley -- known for ancient monasteries and Tibetan culture -- with the Manaslu Circuit, culminating in the Larkya La Pass crossing. One of Nepal's least crowded major treks.

**Itinerary:**
- Day 1: Drive Kathmandu to Machha Khola (869m) -- 8-10 hrs
- Day 2: Trek to Jagat (1,340m) -- 6-7 hrs
- Day 3: Trek to Lokpa (2,240m) -- 6-7 hrs
- Day 4: Trek to Chumling (2,386m) -- 6-7 hrs
- Day 5: Trek to Chhokangparo (3,031m) -- 5-6 hrs
- Day 6: Trek to Nile (3,361m) via Milarepa Cave -- 6-7 hrs
- Day 7: Day trip to Mu Gompa (3,700m), trek to Chhokangparo -- 7-8 hrs
- Day 8: Trek to Lokpa (2,240m) -- 6-7 hrs
- Day 9: Trek to Deng (1,860m) -- 6-7 hrs
- Day 10: Trek to Namrung (2,630m) -- 6-7 hrs
- Day 11: Trek to Lho (3,180m) -- 4-5 hrs
- Day 12: Trek to Samagaon (3,530m) -- 3-4 hrs
- Day 13: Acclimatization day, explore Birendra Lake
- Day 14: Trek to Samdo (3,860m) -- 3-4 hrs
- Day 15: Trek to Dharmashala (4,460m) -- 4-5 hrs
- Day 16: Cross Larkya La Pass (5,106m), descend to Bimthang (3,590m) -- 8-9 hrs
- Day 17: Trek to Gho (2,515m) -- 5-6 hrs
- Day 18: Trek to Tilche, drive to Kathmandu/Pokhara

**Pricing (per person):**
| Group Size | Price |
|---|---|
| 1 pax | $900 |
| 2 pax | $600 |
| 4 pax | $525 |
| 6 pax | $480 |
| 8 pax | $450 |
| 9+ pax | $430 |

**Key highlights:** Sacred Tsum Valley monasteries, Mt Manaslu (8,163m) views, Larkya La Pass crossing, Tibetan refugee villages, remote pristine trails, Birendra Lake.

---

#### Trek 6: Everest Base Camp with Gokyo Ri
- **Duration:** 15 days
- **Difficulty:** Strenuous
- **Max altitude:** 5,555m (Kala Patthar)
- **Best season:** Spring (Mar-May), Autumn (Sep-Nov)
- **Overview:** The ultimate Everest experience combining the classic Base Camp trek with Gokyo Ri and the challenging Cho La Pass crossing. Includes the turquoise Gokyo Lakes, Sherpa culture, and standing at the foot of the world's highest peak.

**Itinerary:**
- Day 1: Arrival in Kathmandu
- Day 2: Fly to Lukla, trek to Phakding (2,610m) -- 3-4 hrs
- Day 3: Trek to Namche Bazaar (3,441m) -- 6-7 hrs
- Day 4: Acclimatization in Namche
- Day 5: Trek to Dole (4,200m) -- 5-6 hrs
- Day 6: Trek to Machhermo (4,470m) -- 4-5 hrs
- Day 7: Trek to Gokyo (4,790m) -- 5-6 hrs
- Day 8: Summit Gokyo Ri (5,357m), trek to Thangnak -- sunrise
- Day 9: Cross Cho La Pass (5,368m) to Dzongla -- 6-9 hrs
- Day 10: Trek to Lobuche (4,910m) -- 4-5 hrs
- Day 11: Trek to EBC (5,365m) via Gorak Shep -- 7-8 hrs
- Day 12: Kala Patthar (5,555m) sunrise, descend to Pheriche -- full day
- Day 13: Trek to Namche Bazaar -- 6-7 hrs
- Day 14: Trek to Lukla -- 6-7 hrs
- Day 15: Fly Lukla to Kathmandu

**Pricing (per person):**
| Group Size | Price |
|---|---|
| 1-2 pax | $800 |
| 3-4 pax | $700 |
| 5-6 pax | $650 |
| 7+ pax | $600 |

**Key highlights:** Everest Base Camp, Gokyo Ri 360-degree panorama, Cho La Pass glacial crossing, Gokyo Lakes, Kala Patthar sunrise, Sherpa culture and Namche Bazaar.

---

### What's Included / Not Included (applies to ALL treks -- show once as a shared section or per-trek)

**Included in all treks:**
- Airport pickup (private transport to hotel)
- Ground transportation to/from trek start/end points
- Experienced English-speaking trekking guide (salary, food, insurance, accommodation, transport all covered)
- All required trekking permits
- Mountain guesthouse/teahouse accommodation during trek
- Trekking equipment loan: sleeping bag, down jacket, trekking poles (returned after trek)
- Emergency rescue coordination (covered by your travel insurance)
- Government taxes and service charges
- First aid kit carried by guide

**Not included:**
- Meals (breakfast, lunch, dinner) -- purchased at teahouses along the route
- Drinks, snacks, bar bills
- Personal expenses (hot showers, charging, Wi-Fi, heating at teahouses)
- Travel insurance (mandatory -- must cover high-altitude trekking and evacuation)
- Personal trekking gear (boots, clothing, etc.)
- Costs from unforeseen circumstances (weather, strikes, landslides, illness)
- Tips for guide and porters (customary in Nepal)

---

### 4. Reviews / Testimonials Section
- Title: "What Trekkers Say"
- Display 3-4 hardcoded testimonial cards with: quote, name, trek completed, date
- Use these placeholder reviews (Sandip will replace with real ones):

> "Sandip made our Langtang trek unforgettable. His knowledge of the trails and local culture turned a great hike into a life-changing experience." -- *Anna & Mark, Netherlands, Langtang Valley Trek, Oct 2024*

> "As a solo traveller I was nervous, but Sandip's warmth and expertise put me at ease from day one. Couldn't recommend more highly." -- *James L., UK, Annapurna Circuit, Mar 2025*

> "The Manaslu trek was the highlight of my year. Remote, raw, and absolutely stunning. Sandip knows every village and every viewpoint." -- *Sophie K., Germany, Manaslu + Tsum Valley, Nov 2024*

### 5. FAQ Section (collapsible accordion)
Include these questions:
- "How fit do I need to be?"
- "What about altitude sickness?"
- "Do I need travel insurance?"
- "What should I pack?"
- "Can I join as a solo trekker?"
- "How do I get to Nepal / do I need a visa?"
- "Are meals included?"
- "What is the best time to trek in Nepal?"

Write sensible, warm, helpful answers for each. Keep them concise.

### 6. Contact / Booking Section
- Title: "Ready for Your Adventure?" or similar
- Brief warm text: "Whether you have questions or you're ready to book, Sandip is just a message away."
- Large WhatsApp button (opens: https://wa.me/9779851353347?text=Hi%20Sandip%2C%20I%20found%20your%20website%20and%20I%27m%20interested%20in%20trekking%20in%20Nepal.%20Could%20you%20tell%20me%20more%3F)
- Email link: magicbeyondhimalaya@gmail.com
- Phone: +977 9851353347
- Embedded Google Maps showing business location

### 7. Footer
- Company name and tagline
- Quick links to page sections
- Social links placeholders (WhatsApp, Instagram, Facebook)
- "© 2025 Magic Beyond Himalaya. All rights reserved."

---

## Technical Requirements
- **Single HTML file** with all CSS and JS inline. No external dependencies except Google Fonts and any placeholder image service.
- **Responsive / mobile-first.** Must look great on phones first, then scale up.
- **Smooth scroll** navigation between sections.
- **Sticky navigation bar** that appears on scroll with section links.
- **Sticky WhatsApp floating button** (bottom-right corner, always visible).
- **Lazy-load images** for performance.
- **Semantic HTML** with proper heading hierarchy for SEO.
- Include a `<meta>` description tag optimised for: "Nepal trekking guide | Annapurna, Everest, Langtang, Manaslu treks | Local guides since 2017"
- All interactive elements (modals, accordions, FAQ) should work with vanilla JS, no libraries.
- Use CSS custom properties (variables) for colours so Sandip or Patrick can easily re-theme later.
- Keep the total file size reasonable -- aim for under 50KB excluding images.

## Important Notes
- All placeholder images should use a consistent service (e.g. picsum.photos) with mountain/landscape themes where possible. Add HTML comments like `<!-- REPLACE: Add your Langtang trek photo here -->` next to each image so Sandip knows what to swap.
- The WhatsApp "Book This Trek" buttons on individual treks should prefill the message with the trek name.
- Prices should be displayed in USD ($).
- The tone of all copy should be warm, personal, and encouraging -- never corporate or salesy. Write as if a knowledgeable friend is helping you plan an adventure.
- Add a simple "Trek Finder" filter at the top of the trek section: filter by difficulty and/or duration (short/medium/long). Keep it simple -- just show/hide cards.
