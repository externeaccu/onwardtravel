const TREKS = [
  {
    id: 'poon-hill',
    name: 'Ghorepani Poon Hill',
    region: 'Annapurna · Foothills',
    days: 4,
    difficulty: 'Easy to Moderate',
    diffKey: 'easy',
    altitude: '3,210 m',
    fromPrice: 150,
    season: 'Spring (Mar–May) · Autumn (Sep–Nov)',
    image: 'images/sunrise-peak.jpeg',
    overview: "A short trek in Nepal's Annapurna region, famed for breathtaking sunrise views over the Himalayas. Stand at Poon Hill at first light and watch the sun ignite Dhaulagiri, Annapurna, and Machhapuchhre. The route winds through rhododendron forests, Gurung villages, and tiered terraces — a perfect first taste of Nepal.",
    overview2: "What makes this trek special isn't just the altitude on the chart — it's the rhythm of the days. You'll wake to the sound of village roosters, walk through forests that bloom red and pink in spring, share dal bhat with families who've lived on these slopes for generations, and stand at Poon Hill before dawn watching the first gold light hit twenty Himalayan peaks at once. It's the perfect introduction to Nepal: rich enough to feel transformative, gentle enough that anyone with two working legs and a sense of curiosity can do it.",
    overview3: "Physically, this trek is honest work but never extreme. Plenty of stone-step climbs that test your thighs, but no real altitude risk and warm teahouses every night. Most days are 5–7 hours of walking with long breaks for tea and lunch. By the end you'll feel like you've earned every photograph — and you'll know which valley you want to come back to next time.",
    highlights: [
      ['Poon Hill sunrise over 20+ Himalayan peaks','sunrise'],
      ['Rhododendron forests in full bloom (spring)','forest'],
      ['Cultural immersion in Gurung villages','culture'],
      ['Low altitude — minimal sickness risk','safe'],
      ['Suitable for beginners and families','family']
    ],
    days_data: [
      { day:1, route:'Pokhara → Nayapul → Ulleri', alt:2050, time:'5–6 hrs',
        desc:"Scenic 1.5-hour drive from Pokhara to Nayapul, the trek's starting point. Walk through terraced farmland and cross suspension bridges past villages like Birethanti and Hile. The day ends with a steep ascent to Ulleri via 3,200 stone steps, with views of Annapurna South opening up as you climb.",
        tags:['Terraced farms','Suspension bridges','Stone steps','Annapurna South views'] },
      { day:2, route:'Ulleri → Ghorepani', alt:2860, time:'5–6 hrs',
        desc:"Trek through dense rhododendron and oak forests (spectacular blooms in spring). Pass through Magar villages including Banthanti and Nangethanti. Arrive in Ghorepani, a Gurung-majority village with mountain views from every teahouse.",
        tags:['Rhododendron forest','Magar villages','Mountain vistas'] },
      { day:3, route:'Poon Hill (3,210m) → Tadapani', alt:2630, time:'6–7 hrs',
        desc:"Pre-dawn hike to Poon Hill for a legendary sunrise over the Annapurna and Dhaulagiri ranges. On a clear morning you can see over 20 Himalayan peaks including Dhaulagiri (8,167m), Annapurna I (8,091m), and Machhapuchhre. Descend through forests to Tadapani with ongoing views of Annapurna South.",
        tags:['Sunrise panorama','Dhaulagiri','Annapurna','20+ peaks'] },
      { day:4, route:'Ghandruk → Pokhara', alt:1940, time:'4–5 hrs + 2 hr drive',
        desc:"Explore Ghandruk, a picturesque Gurung village with traditional stone houses and mountain views. Visit local museums or enjoy cultural interactions with villagers. Drive back to Pokhara via Nayapul.",
        tags:['Gurung village','Cultural museum','Traditional architecture'] }
    ],
    pricing: [['1 pax', 300],['2 pax', 225],['4 pax', 200],['6 pax', 180],['8 pax', 165],['9+ pax', 150]]
  },
  {
    id: 'mardi-himal',
    name: 'Mardi Himal',
    region: 'Annapurna · Mardi Ridge',
    days: 5,
    difficulty: 'Moderate',
    diffKey: 'moderate',
    altitude: '4,500 m (Mardi Himal Base Camp)',
    fromPrice: 160,
    season: 'Spring (Mar–May) · Autumn (Sep–Nov)',
    // REPLACE: needs a real Mardi Himal photo — this one is borrowed from another trek
    image: 'images/sunrise-peak.jpeg',
    overview: "A short, quiet ridge walk in the Annapurna region, finishing at Mardi Himal Base Camp at 4,500 m. The trail climbs out of rhododendron and oak forest onto a narrow ridge, with Machhapuchhre, Mardi Himal, Annapurna South and Hiunchuli close enough to feel like they are leaning over you.",
    overview2: "Mardi Himal runs alongside the Annapurna Base Camp trail but draws a fraction of the traffic. You walk whole afternoons through forest without meeting anyone, sleep in teahouses run by Gurung and Magar families, and climb each day onto a ridge that keeps opening out. The final morning is the payoff — a long, steady push toward Base Camp with the Fishtail summit filling the sky ahead of you.",
    overview3: "Five days from Pokhara and back, with no technical ground anywhere on the route. You should be comfortable walking four to eight hours a day on steep trail. The hardest sections are the climb to High Camp and the early start toward Base Camp. It suits a first Himalayan trek as well as it suits someone with only a week to spend.",
    highlights: [
      ['Machhapuchhre, Mardi Himal and Annapurna South up close','vista'],
      ['A ridge route with far fewer trekkers than ABC','quiet'],
      ['Rhododendron and oak forest giving way to alpine meadow','forest'],
      ['Gurung and Magar teahouse hospitality','culture'],
      ['Five days from Pokhara — short enough for a tight trip','reward']
    ],
    days_data: [
      { day:1, route:'Pokhara → Kande → Forest Camp', alt:2600, time:'5–7 hrs',
        desc:"An hour's drive from Pokhara to Kande, then straight into the climb. The trail works up through rhododendron and oak forest, with the Annapurna range showing through gaps in the canopy. Forest Camp sits in deep woodland — quiet, green, and a long way from the crowds on the main Annapurna trails.",
        tags:['Drive from Pokhara','Rhododendron forest','Steady climb'] },
      { day:2, route:'Forest Camp → Badal Danda', alt:3210, time:'5–6 hrs',
        desc:"A steeper day through the Annapurna Conservation Area. The forest thins as you gain height and the ridge begins to reveal itself. Badal Danda is a high shoulder with views in every direction — a good place to sit out the late afternoon and watch the light move across the peaks.",
        tags:['Conservation area','Forest to ridge','Panoramic views'] },
      { day:3, route:'Badal Danda → High Camp', alt:3550, time:'3–4 hrs',
        desc:"A short day, and a welcome one. The trail leaves the treeline for alpine meadow, the peaks sharpening the higher you go. High Camp is the launching point for Base Camp, so the afternoon is for resting, acclimatising, and watching the sun go down over Machhapuchhre.",
        tags:['Short day','Alpine meadow','Acclimatisation'] },
      { day:4, route:'High Camp → Mardi Himal Base Camp (4,500m) → Low Camp', alt:3150, time:'7–9 hrs',
        desc:"The big day. A long climb along the ridge to Mardi Himal Base Camp at 4,500 m, with Mardi Himal and the surrounding peaks laid out around you. Time at the top to take it in, then a long descent through changing landscape all the way down to Low Camp.",
        tags:['Base camp 4,500 m','Ridge walk','Long descent'] },
      { day:5, route:'Low Camp → Sidding → Pokhara', alt:850, time:'5–6 hrs',
        desc:"Down through villages and terraced fields on a completely different side of the mountain. Your driver meets you at Sidding for the road back to Pokhara.",
        tags:['Village descent','Terraced fields','Drive to Pokhara'] }
    ],
    pricing: [['1 pax', 325],['2 pax', 250],['4 pax', 225],['6 pax', 200],['8 pax', 175],['9+ pax', 160]]
  },
  {
    id: 'langtang',
    name: 'Langtang Valley',
    region: 'Langtang · North of Kathmandu',
    days: 7,
    difficulty: 'Moderate',
    diffKey: 'moderate',
    altitude: '4,773 m (Kyanjin Ri)',
    fromPrice: 150,
    season: 'Spring (Mar–May) · Autumn (Sep–Nov)',
    image: 'images/forest-ridge.jpeg',
    overview: 'Ideal for travellers with limited time who still want big Himalayan vistas, Tamang culture, and quiet trails. The route climbs through rhododendron forest into a sweeping glacial valley beneath Langtang Lirung (7,246 m), with the option to summit Tserko Ri for a 360° panorama.',
    overview2: "Langtang has a quieter, more intimate feel than the headline treks. You walk for whole afternoons without seeing another tourist, share teahouses with yak herders, and arrive each evening to villages where the kitchen is still the heart of everyday life. The valley itself is breathtaking — rhododendron forest gives way to alpine pasture and finally to a wide glacial amphitheatre with Langtang Lirung looming over you.",
    overview3: "There's a deeper layer here too. The 2015 earthquake hit this valley hard, and the rebuilt villages tell a story of resilience that's impossible to miss. Trekking Langtang means your money goes directly into a region that genuinely needs it — and the welcome you get from Tamang families along the way reflects that.",
    highlights: [
      ['Far fewer crowds than Everest or Annapurna','quiet'],
      ['360° sunrise from Kyanjin Ri (4,773 m)','sunrise'],
      ['Ancient Kyanjin Gompa monastery','culture'],
      ['Deep Tamang cultural heritage','culture'],
      ['Langtang National Park wildlife','wildlife']
    ],
    days_data: [
      { day:1, route:'Kathmandu → Syabrubesi', alt:1460, time:'6–7 hrs drive',
        desc:"Scenic drive through the Trishuli Valley with views of Ganesh Himal and the Langtang ranges. The road winds through small towns and terraced hillsides. Overnight in Syabrubesi, the gateway to the Langtang region.",
        tags:['Trishuli Valley','Ganesh Himal views','Gateway village'] },
      { day:2, route:'Syabrubesi → Lama Hotel', alt:2470, time:'5–6 hrs',
        desc:"Follow the trail through subtropical forests, crossing the Bhote Koshi River on suspension bridges. The forest is home to langur monkeys and rich birdlife. The trail climbs steadily through shaded woodland.",
        tags:['Subtropical forest','Langur monkeys','River crossings'] },
      { day:3, route:'Lama Hotel → Langtang Village', alt:3500, time:'5–6 hrs',
        desc:"Ascend through oak and rhododendron forests to Ghoda Tabela (an army outpost), then continue to Langtang Village. The village was rebuilt after the devastating 2015 earthquake and showcases resilient Tamang culture and architecture.",
        tags:['Rhododendron forest','Earthquake memorial','Tamang culture'] },
      { day:4, route:'Langtang → Kyanjin Gompa', alt:3800, time:'4–5 hrs',
        desc:"Walk through yak pastures with mountain walls rising on both sides. Visit the local cheese factory and the ancient Kyanjin monastery. Optional afternoon hike to Langshisha Kharka for glacier views.",
        tags:['Yak pastures','Cheese factory','Kyanjin monastery','Glacier views'] },
      { day:5, route:'Kyanjin Ri (4,773m) → Lama Hotel', alt:2470, time:'6–7 hrs',
        desc:"Early morning hike for the trek's highlight: a 360-degree sunrise panorama of the entire Langtang range including Langtang Lirung (7,227m), Yala Peak, and Dorje Lakpa. The more ambitious can push to Tserko Ri at 5,030m. Long descent back to Lama Hotel.",
        tags:['360° panorama','Langtang Lirung','Summit day','Big descent'] },
      { day:6, route:'Lama Hotel → Syabrubesi', alt:1470, time:'5–6 hrs',
        desc:"Retrace the trail or take an alternative route via Sherpa Gaon, enjoying a final day in the forests and valley.",
        tags:['Alternative route','Forest walk','Final valley views'] },
      { day:7, route:'Syabrubesi → Kathmandu', alt:1400, time:'6–7 hrs drive',
        desc:"Return journey through the Trishuli Valley with farewell dinner in Kathmandu.",
        tags:['Return drive','Farewell dinner'] }
    ],
    pricing: [['1 pax', 325],['2 pax', 250],['4 pax', 225],['6 pax', 200],['8 pax', 175],['9+ pax', 150]]
  },
  {
    id: 'annapurna-tilicho',
    name: 'Annapurna Circuit + Tilicho Lake',
    region: 'Annapurna · Full circuit',
    days: 11,
    difficulty: 'Challenging to Strenuous',
    diffKey: 'challenging',
    altitude: '5,416 m (Thorong La)',
    fromPrice: 225,
    season: 'Spring (Mar–May) · Autumn (Sep–Nov)',
    image: 'images/manaslu-village.jpeg',
    overview: 'A comprehensive Annapurna circuit with a side trip to Tilicho Lake (4,919 m) — one of the highest lakes on earth. Cross the iconic Thorong La Pass and descend to the sacred temple of Muktinath. The trail moves through jungle, alpine meadow, and arid Tibetan-feeling plateau in a single trip.',
    overview2: "What's remarkable about this circuit is how many different worlds you walk through. You start in subtropical river valleys with banana trees and butterflies. By day five you're in alpine meadows. By day seven you're standing beside a turquoise glacial lake at nearly 5,000 metres. By day ten you've crossed a 5,416-metre pass into a landscape that feels more like Tibet than Nepal — arid, wide, and ancient.",
    overview3: "This is a serious undertaking. The Thorong La crossing is genuinely challenging — you start in the dark, climb for hours in thin air, and only fully relax once you're on the other side. But the acclimatisation is built in, the team behind you is experienced, and the reward — Tilicho's blue water, Muktinath's temple bells, that long downhill into a different world — is unforgettable.",
    highlights: [
      ['Tilicho Lake — 4,919 m turquoise water','lake'],
      ['Cross Thorong La Pass (5,416 m)','pass'],
      ['Sacred Muktinath Temple','culture'],
      ['Jungle to glacier ecosystems','nature'],
      ['Tibetan-influenced upper Manang','culture']
    ],
    days_data: [
      { day:1, route:'Kathmandu → Dharapani', alt:1860, time:'8–10 hrs drive',
        desc:"Long scenic drive via Besisahar, following the Marsyangdi River through terraced farmland, subtropical forests, and Himalayan foothills. The landscape shifts dramatically as you climb toward the Annapurna region.",
        tags:['Marsyangdi River','Terraced farms','Himalayan foothills'] },
      { day:2, route:'Dharapani → Chame', alt:2710, time:'5–6 hrs',
        desc:"Trail winds through pine forests with views of Annapurna II and Lamjung Himal emerging above the treeline. Pass traditional mani walls and Tibetan-style villages that mark the cultural transition into the upper Annapurna region.",
        tags:['Pine forests','Annapurna II views','Mani walls','Tibetan villages'] },
      { day:3, route:'Chame → Upper Pisang', alt:3300, time:'5–6 hrs',
        desc:"Take the upper route for panoramic views of Pisang Peak and the Annapurna massif. Visit Braga Monastery en route, one of the oldest in the region with its cave-like rooms carved into the cliff face.",
        tags:['Pisang Peak panorama','Braga Monastery','Upper route'] },
      { day:4, route:'Pisang → Manang', alt:3540, time:'4–5 hrs',
        desc:"Enter the arid Manang Valley, a dramatic contrast to the forests below. Use the afternoon to acclimatise with short hikes to Gangapurna Lake (milky blue glacial lake) or Ice Lake (stunning viewpoint at 4,600m).",
        tags:['Manang Valley','Gangapurna Lake','Acclimatisation','Arid landscape'] },
      { day:5, route:'Acclimatisation in Manang', alt:3540, time:'rest day',
        desc:"Explore ancient monasteries, visit the Himalayan Rescue Association post for altitude sickness advice, or simply soak in the mountain atmosphere. This rest day is essential before the high-altitude days ahead.",
        tags:['Rest day','Monasteries','Himalayan Rescue Association'] },
      { day:6, route:'Manang → Tilicho Base Camp', alt:4150, time:'7–8 hrs',
        desc:"A demanding day with steep ascent via Khangsar, the last village before Tilicho. Some sections are landslide-prone, requiring an early start and careful footing. The terrain grows increasingly raw and alpine.",
        tags:['Steep ascent','Khangsar village','Landslide sections','Early start'] },
      { day:7, route:'Tilicho Lake (4,919m) → Siri Kharka', alt:4060, time:'7–8 hrs',
        desc:"The trek's hidden gem. Tilicho Lake sits at 4,919m, one of the world's highest lakes, its turquoise waters surrounded by Tilicho Peak and the Annapurna range. Start at dawn to avoid afternoon winds. The sight is genuinely breathtaking.",
        tags:['Tilicho Lake','One of world\'s highest','Turquoise water','Dawn start'] },
      { day:8, route:'Siri Kharka → Yak Kharka', alt:4060, time:'5 hrs',
        desc:"Descend into the Thorong Khola Valley. Keep eyes open for blue sheep (bharal) on the rocky slopes. The landscape is stark and beautiful, preparing you mentally for the pass crossing ahead.",
        tags:['Thorong Khola Valley','Blue sheep','Alpine desert'] },
      { day:9, route:'Yak Kharka → Thorong High Camp', alt:4880, time:'4–5 hrs',
        desc:"Short but significant hike to the base camp for tomorrow's pass crossing. Optional acclimatisation hike to a nearby viewpoint. Sleep as early as possible — tomorrow starts before dawn.",
        tags:['High camp','Pass preparation','Early night'] },
      { day:10, route:'Thorong La (5,416m) → Muktinath', alt:3760, time:'8–10 hrs',
        desc:"The biggest day of the trek. Steep pre-dawn ascent in darkness, rewarded with extraordinary views of Dhaulagiri and Annapurna from the top. Descend to Muktinath and visit the sacred temple, holy to both Hindus and Buddhists. A day of physical challenge and spiritual arrival.",
        tags:['Thorong La 5,416m','Pre-dawn start','Dhaulagiri views','Muktinath'] },
      { day:11, route:'Muktinath → Pokhara', alt:820, time:'9–10 hrs drive',
        desc:"Long drive down from the mountains to Pokhara. Overnight in a lakeside hotel — a well-earned rest after the circuit.",
        tags:['Return drive','Pokhara lakeside'] }
    ],
    pricing: [['1 pax', 490],['2 pax', 350],['4 pax', 300],['6 pax', 275],['8 pax', 250],['9+ pax', 225]]
  },
  {
    id: 'abc-poon',
    name: 'Annapurna Base Camp + Poon Hill',
    region: 'Annapurna · Sanctuary',
    days: 8,
    difficulty: 'Moderate to Challenging',
    diffKey: 'moderate',
    altitude: '4,130 m (ABC)',
    fromPrice: 170,
    season: 'Spring (Mar–May) · Autumn (Sep–Nov)',
    image: 'images/trail-village.jpeg',
    overview: "Combine the Annapurna Sanctuary — a glacial amphitheatre ringed by 8,000-metre giants — with the classic Poon Hill sunrise. A complete Annapurna experience packed into just over a week, ending with the warm waters of Jhinu Danda hot springs.",
    overview2: "The Annapurna Sanctuary is one of those places that doesn't feel quite real when you're standing in it. You walk for days through forest and farmland, and then — all at once — the trail opens into a vast glacial bowl with 8,000-metre peaks rising in every direction. Annapurna I, Hiunchuli, Annapurna South, the unmistakable fang of Machhapuchhre. You sleep there, watch the sunrise paint them gold, and walk back down a changed person.",
    overview3: "Adding Poon Hill at the start gives you the famous sunrise panorama before you've even started the main climb. And ending at Jhinu Danda means a soak in natural hot springs by the river on your last morning — exactly where sore legs need to be after a week in the mountains.",
    highlights: [
      ['Annapurna Sanctuary 360° views','vista'],
      ['Machhapuchhre (Fishtail) up close','peak'],
      ['Poon Hill sunrise included','sunrise'],
      ['Jhinu Danda natural hot springs','reward'],
      ['Spring rhododendron blooms','forest']
    ],
    days_data: [
      { day:1, route:'Pokhara → Tikhedhunga → Ulleri', alt:2050, time:'2–3 hrs trek',
        desc:"Drive from Pokhara to Tikhedhunga (2.5 hours), then a short trek to Ulleri through Magar villages and terraced fields with stone steps.",
        tags:['Magar villages','Terraced fields','Stone steps'] },
      { day:2, route:'Ulleri → Ghorepani', alt:2870, time:'5–6 hrs',
        desc:"Ascend through dense rhododendron forests with mountain views building as you gain altitude. Teahouses in Ghorepani offer cozy stays and panoramic mountain views from the village.",
        tags:['Rhododendron forest','Mountain views','Cozy teahouses'] },
      { day:3, route:'Poon Hill sunrise → Tadapani', alt:2600, time:'7–8 hrs',
        desc:"Pre-dawn hike to Poon Hill (3,210m) for the stunning sunrise panorama over the Annapurna and Dhaulagiri ranges. Then a long day descending through forests to Tadapani.",
        tags:['Poon Hill sunrise','Panoramic views','Forest descent'] },
      { day:4, route:'Tadapani → Sinuwa', alt:2340, time:'6–7 hrs',
        desc:"Steep descent and ascent via Kimrong Khola. Cross suspension bridges, walk through rhododendron forests, and descend 2,500 stone steps to Chhomrong Khola before climbing to Sinuwa.",
        tags:['Suspension bridges','Kimrong Khola','Steep stone steps'] },
      { day:5, route:'Sinuwa → Deurali', alt:3230, time:'5–6 hrs',
        desc:"Enter the bamboo forests along the Modi Khola River. Pass Hinku Cave and catch views of Machhapuchhre (Fishtail) through the canopy. Waterfalls line the narrow valley.",
        tags:['Bamboo forests','Modi Khola','Hinku Cave','Machhapuchhre'] },
      { day:6, route:'Deurali → MBC → ABC (4,130m)', alt:4130, time:'6–7 hrs',
        desc:"The key day. Pass through Machhapuchhre Base Camp at 3,700m, then enter the Annapurna Sanctuary itself — a glacial amphitheatre with 360-degree views of Annapurna I, Hiunchuli, Annapurna South, and Machhapuchhre towering above you on all sides. Unforgettable.",
        tags:['Annapurna Sanctuary','360° amphitheatre','Annapurna I','MBC'] },
      { day:7, route:'ABC → Bamboo', alt:2310, time:'7–8 hrs',
        desc:"Enjoy a final sunrise at ABC, then begin the long descent retracing steps through the sanctuary and back into the forests.",
        tags:['ABC sunrise','Long descent','Forest return'] },
      { day:8, route:'Jhinu Danda hot springs → Pokhara', alt:1760, time:'4 hrs trek',
        desc:"Final morning trek to Jhinu Danda with a rewarding detour to natural hot springs by the Modi Khola river — perfect for sore muscles after a week of trekking. Drive back to Pokhara.",
        tags:['Jhinu hot springs','Modi Khola','Trek completion'] }
    ],
    pricing: [['1 pax', 400],['2 pax', 280],['4 pax', 230],['6 pax', 200],['8 pax', 185],['9+ pax', 170]]
  },
  {
    id: 'manaslu-circuit',
    name: 'Manaslu Circuit',
    region: 'Manaslu · Budhi Gandaki',
    days: 12,
    difficulty: 'Challenging to Strenuous',
    diffKey: 'challenging',
    altitude: '5,106 m (Larkya La Pass)',
    fromPrice: 390,
    season: 'Spring (Mar–May) · Autumn (Sep–Nov)',
    // REPLACE: needs a photo of its own — currently shared with the Tsum Valley trek
    image: 'images/manaslu-village.jpeg',
    overview: "A twelve-day circuit of Manaslu (8,163 m), the world's eighth-highest mountain, following the Budhi Gandaki river from subtropical gorge to high alpine crossing. The route climbs through Tibetan-influenced villages past monasteries, chortens and mani walls, and finishes over the Larkya La Pass at 5,106 m.",
    overview2: "This is the Manaslu Circuit without the Tsum Valley detour — the same great walk, six days shorter. You follow the river up through forest, waterfall and suspension bridge, and the valley narrows around you day by day until the trees give out and the landscape turns barren and Tibetan in character. Samagaun, the largest settlement in the upper valley, earns its acclimatisation day: Birendra Lake and the Manaslu Base Camp trail both start from the doorstep.",
    overview3: "The Larkya La crossing is the hard part and the reason people come. You start very early, climb for hours in thin air, then drop a long way to Bimthang on the far side — eight to ten hours in all. Expect cold, wind and possibly snow at the pass. The route is genuinely remote, facilities thin out in the upper valley, and the roads at either end are rough.",
    highlights: [
      ['Larkya La Pass at 5,106 m','pass'],
      ['Manaslu (8,163 m) seen close up','peak'],
      ['Tibetan-influenced villages, monasteries and mani walls','culture'],
      ['Subtropical gorge to glacier on one route','nature'],
      ['Birendra Lake and Manaslu Base Camp from Samagaun','lake']
    ],
    days_data: [
      { day:1, route:'Kathmandu → Machha Khola', alt:900, time:'',
        desc:"Drive out through Dhading, Arughat and Soti Khola, following the Budhi Gandaki valley to the trailhead. The road gets rougher the closer you get.",
        tags:['Long drive','Budhi Gandaki valley','Rough road'] },
      { day:2, route:'Machha Khola → Jagat', alt:1340, time:'',
        desc:"Walking starts, beside the river. Suspension bridges, waterfalls, forest and small settlements all the way to Jagat.",
        tags:['River trail','Suspension bridges','Waterfalls'] },
      { day:3, route:'Jagat → Deng', alt:1860, time:'',
        desc:"On through the gorge past Philim and forested hillside. The valley tightens and turns more mountainous as you approach Deng.",
        tags:['Deep gorge','Philim','Forest'] },
      { day:4, route:'Deng → Namrung', alt:2630, time:'',
        desc:"The landscape shifts noticeably with the height gained. More forest, waterfalls and bridges before Namrung, the gateway into the upper Manaslu region.",
        tags:['Gateway village','Height gain','Changing landscape'] },
      { day:5, route:'Namrung → Shyala', alt:3500, time:'',
        desc:"The trail climbs into properly alpine country, with Manaslu, Manaslu North and Himalchuli opening up around you.",
        tags:['Alpine scenery','Manaslu views','Himalchuli'] },
      { day:6, route:'Shyala → Samagaun', alt:3530, time:'',
        desc:"A short, spectacular walk through alpine landscape to Samagaun, the largest settlement in the upper valley.",
        tags:['Short day','Samagaun','Upper valley'] },
      { day:7, route:'Acclimatisation at Samagaun', alt:3530, time:'',
        desc:"A day to let your body catch up before going higher. Options include Pungen Gompa, Manaslu Base Camp, Birendra Lake, or the monasteries and viewpoints nearby.",
        tags:['Acclimatisation','Birendra Lake','Base Camp option'] },
      { day:8, route:'Samagaun → Samdo', alt:3860, time:'',
        desc:"Leave the main valley and climb gradually to Samdo, close to the Tibetan border. The country here is bare and Tibetan in feel.",
        tags:['Tibetan border','Barren country','Gradual climb'] },
      { day:9, route:'Samdo → Dharamsala (Larkya Phedi)', alt:4460, time:'',
        desc:"Short on distance, serious on altitude. Follow the Larkya river up to Dharamsala and sort your kit and clothing for the pass in the morning.",
        tags:['Altitude gain','Larkya Phedi','Pass preparation'] },
      { day:10, route:'Dharamsala → Larkya La (5,106m) → Bimthang', alt:3700, time:'8–10 hrs',
        desc:"The biggest day of the trek. A very early start and a long climb to Larkya La at 5,106 m, with the surrounding Himalayan peaks laid out from the top, then a long descent to Bimthang.",
        tags:['Larkya La 5,106 m','Pre-dawn start','Long descent'] },
      { day:11, route:'Bimthang → Tilije / Dharapani', alt:1900, time:'',
        desc:"A dramatic drop out of the high alpine into forest and lower valley, joining the route across to the Annapurna region.",
        tags:['Steep descent','Forest','Annapurna link'] },
      { day:12, route:'Tilije / Dharapani → Kathmandu or Pokhara', alt:1400, time:'',
        desc:"Jeep to Besisahar and on by road to Kathmandu or Pokhara, whichever suits your onward plans.",
        tags:['Jeep transfer','Besisahar','Trek complete'] }
    ],
    pricing: [['1 pax', 680],['2 pax', 550],['4 pax', 500],['6 pax', 450],['8 pax', 420],['9+ pax', 390]]
  },
  {
    id: 'manaslu-tsum',
    name: 'Manaslu + Tsum Valley',
    region: 'Manaslu · Remote Himalaya',
    days: 18,
    difficulty: 'Challenging to Strenuous',
    diffKey: 'strenuous',
    altitude: '5,106 m (Larkya La)',
    fromPrice: 430,
    season: 'Spring (Mar–May) · Autumn (Sep–Nov)',
    image: 'images/prayer-flags.jpeg',
    overview: "An eighteen-day passage combining the sacred Tsum Valley — ancient monasteries, Tibetan refugee villages, the Milarepa Cave — with the full Manaslu Circuit, capped by the Larkya La Pass. One of Nepal's least crowded great walks, and a personal favourite.",
    overview2: "Manaslu with Tsum Valley is, honestly, the trek I recommend to people who've already done one or two big Himalayan walks and want something deeper. The crowds thin almost completely after the first few days. The Tsum Valley feels like stepping back five hundred years — Buddhist monasteries carved into cliffs, Tibetan refugee villages with prayer wheels older than any of us, the cave where Milarepa is said to have meditated.",
    overview3: "Then you rejoin the main circuit and walk for days under the shadow of Manaslu itself, the world's eighth-highest peak. The final pass — Larkya La at 5,106 metres — is one of the great mountain crossings, with views in every direction of peaks most people will only ever see from a plane. Eighteen days is a commitment. It is also, for many of our trekkers, the trip that ends up meaning the most.",
    highlights: [
      ['Sacred Tsum Valley monasteries','culture'],
      ['Mt Manaslu (8,163 m) views','peak'],
      ['Cross Larkya La Pass (5,106 m)','pass'],
      ['Tibetan refugee villages','culture'],
      ['Remote pristine trails','quiet'],
      ['Birendra Lake','lake']
    ],
    days_data: [
      { day:1, route:'Kathmandu → Machha Khola', alt:869, time:'8–10 hrs drive',
        desc:"Long scenic drive through Nepal's countryside, passing terraced fields, traditional villages, and alongside the Trishuli and Budhi Gandaki rivers with glimpses into rural Nepali life.",
        tags:['Countryside drive','Trishuli River','Budhi Gandaki','Rural villages'] },
      { day:2, route:'Machha Khola → Jagat', alt:1340, time:'6–7 hrs',
        desc:"Follow the Budhi Gandaki River, crossing suspension bridges and traversing lush forests. Cascading waterfalls and charming villages line the trail.",
        tags:['Budhi Gandaki River','Suspension bridges','Waterfalls'] },
      { day:3, route:'Jagat → Lokpa', alt:2240, time:'6–7 hrs',
        desc:"Enter the gateway to the Tsum Valley, with a noticeable shift in culture and landscape. Views of Shringi Himal appear as you walk through serene pine forests.",
        tags:['Tsum Valley gateway','Shringi Himal','Pine forests'] },
      { day:4, route:'Lokpa → Chumling', alt:2386, time:'6–7 hrs',
        desc:"Tibetan-influenced culture becomes prominent: ancient monasteries, mani walls, and traditional stone houses. Captivating views of Ganesh Himal.",
        tags:['Tibetan culture','Ancient monasteries','Mani walls','Ganesh Himal'] },
      { day:5, route:'Chumling → Chhokangparo', alt:3031, time:'5–6 hrs',
        desc:"Ascend through fertile agricultural fields and dense forests. Panoramic vistas of Himalchuli and Ganesh Himal open up. Engage with the hospitable local community.",
        tags:['Agricultural terraces','Himalchuli','Local community'] },
      { day:6, route:'Chhokangparo → Nile via Milarepa Cave', alt:3361, time:'6–7 hrs',
        desc:"Visit the sacred Milarepa Cave, steeped in Buddhist history and legend. Continue to Nile, the last village in the upper Tsum Valley, surrounded by towering mountains and ancient monasteries.",
        tags:['Milarepa Cave','Sacred Buddhist site','Upper Tsum Valley'] },
      { day:7, route:'Mu Gompa (3,700m) → Chhokangparo', alt:3031, time:'7–8 hrs',
        desc:"Explore Mu Gompa, the largest monastery in the region, nestled amidst the mountains. Absorb the tranquil atmosphere and gain insights into monastic life before retracing your steps.",
        tags:['Mu Gompa','Largest monastery','Monastic life'] },
      { day:8, route:'Chhokangparo → Lokpa', alt:2240, time:'6–7 hrs',
        desc:"Descend through the valley, appreciating the changing landscapes and reflecting on the sacred Tsum Valley experience.",
        tags:['Valley descent','Tsum Valley farewell'] },
      { day:9, route:'Lokpa → Deng', alt:1860, time:'6–7 hrs',
        desc:"Rejoin the Manaslu Circuit trail. Cross suspension bridges and pass through bamboo forests with views of cascading waterfalls and rugged terrain.",
        tags:['Manaslu Circuit junction','Bamboo forests','Waterfalls'] },
      { day:10, route:'Deng → Namrung', alt:2630, time:'6–7 hrs',
        desc:"Ascend through dense forests and picturesque villages. Namrung provides stunning views of Siring, Ganesh Himal, and Mt Himalchuli.",
        tags:['Dense forests','Namrung village','Himalchuli views'] },
      { day:11, route:'Namrung → Lho', alt:3180, time:'4–5 hrs',
        desc:"Pass through Tibetan-influenced villages adorned with prayer flags and mani walls. In Lho, visit the Ribung Gompa and enjoy close-up views of Mt Manaslu (8,163m).",
        tags:['Prayer flags','Ribung Gompa','Manaslu close-up'] },
      { day:12, route:'Lho → Samagaon', alt:3530, time:'3–4 hrs',
        desc:"A shorter trek allowing for acclimatisation. Samagaon is a village rich in Tibetan culture. Consider visiting Pungyen Gompa or enjoying views of Manaslu Glacier.",
        tags:['Acclimatisation','Tibetan culture','Pungyen Gompa','Manaslu Glacier'] },
      { day:13, route:'Acclimatisation in Samagaon', alt:3530, time:'rest day',
        desc:"Rest day to adapt to altitude. Optional hikes to Birendra Lake (glacial lake) or Pungyen Gompa for breathtaking scenery and cultural immersion.",
        tags:['Rest day','Birendra Lake','Optional hikes'] },
      { day:14, route:'Samagaon → Samdo', alt:3860, time:'3–4 hrs',
        desc:"Gentle ascent to Samdo, a Tibetan refugee village near the border. Observe traditional lifestyles and enjoy panoramic mountain views.",
        tags:['Tibetan refugee village','Border region','Mountain panoramas'] },
      { day:15, route:'Samdo → Dharmashala', alt:4460, time:'4–5 hrs',
        desc:"Base camp for the Larkya La Pass. Basic facilities amidst rugged mountain terrain. Prepare mentally and physically for the challenging pass crossing tomorrow.",
        tags:['Pass base camp','Rugged terrain','Preparation'] },
      { day:16, route:'Larkya La (5,106m) → Bimthang', alt:3590, time:'8–9 hrs',
        desc:"The trek's defining day. From the pass, panoramic views of Himlung Himal, Cheo Himal, Kang Guru, and Annapurna II stretch in every direction before the long descent to the serene valley of Bimthang.",
        tags:['Larkya La 5,106m','Summit panorama','Himlung Himal','Big descent'] },
      { day:17, route:'Bimthang → Gho', alt:2515, time:'5–6 hrs',
        desc:"Descend through alpine meadows and rhododendron forests. Opportunities to spot wildlife in the peaceful environment.",
        tags:['Alpine meadows','Rhododendron','Wildlife'] },
      { day:18, route:'Gho → Tilche → Drive', alt:1500, time:'1.5 hrs + drive',
        desc:"Final descent through charming villages and terraced fields, eventually joining the Annapurna Circuit trail at Dharapani. Drive to Kathmandu or Pokhara.",
        tags:['Final descent','Terraced fields','Trek completion'] }
    ],
    pricing: [['1 pax', 900],['2 pax', 600],['4 pax', 525],['6 pax', 480],['8 pax', 450],['9+ pax', 430]]
  },
  {
    id: 'ebc-gokyo',
    name: 'Everest Base Camp + Gokyo Ri',
    region: 'Khumbu · Everest region',
    days: 15,
    difficulty: 'Strenuous',
    diffKey: 'strenuous',
    altitude: '5,555 m (Kala Patthar)',
    fromPrice: 600,
    season: 'Spring (Mar–May) · Autumn (Sep–Nov)',
    image: 'images/summit-pose.jpeg',
    overview: "The ultimate Everest experience — classic Base Camp combined with Gokyo Ri and the technical Cho La Pass crossing. Stand among the turquoise Gokyo Lakes, sleep in Sherpa lodges, and watch sunrise paint Everest from Kala Patthar at 5,555 m.",
    overview2: "This is the trek that lives in trekkers' imaginations. The flight into Lukla is a thing of legend in itself. From there you walk for two weeks through Sherpa country — Namche Bazaar buzzing with traders, Tengboche Monastery floating above the cloud line, prayer flags strung between mountains so high they don't quite seem real.",
    overview3: "We do the longer Gokyo + Cho La variant rather than the straight Base Camp route because it doubles the experience: you get the lakes, the glacier, a real pass crossing, and Base Camp itself. Three big high-altitude days back to back. It's the hardest trek we run, and for most people who do it, it's also the best.",
    highlights: [
      ['Stand at Everest Base Camp (5,365 m)','peak'],
      ['Sunrise on Kala Patthar (5,555 m)','sunrise'],
      ['360° panorama from Gokyo Ri','vista'],
      ['Cross glacial Cho La Pass','pass'],
      ['Sherpa culture & Namche Bazaar','culture'],
      ['Turquoise Gokyo Lakes','lake']
    ],
    days_data: [
      { day:1, route:'Arrival in Kathmandu', alt:1400, time:'transfer day',
        desc:"Arrive in Kathmandu. Airport pickup and hotel transfer. Meet your guide, discuss the trek, collect equipment including sleeping bag, down jacket, and crampons.",
        tags:['Arrival','Gear check','Briefing'] },
      { day:2, route:'Fly Lukla → Phakding', alt:2610, time:'3–4 hrs',
        desc:"30-minute scenic flight from Kathmandu to Lukla (one of the world's most dramatic airport landings). Trek through the Dudh Koshi Valley past Sherpa villages and suspension bridges.",
        tags:['Lukla flight','Dudh Koshi Valley','Sherpa villages'] },
      { day:3, route:'Phakding → Namche Bazaar', alt:3441, time:'6–7 hrs',
        desc:"Enter Sagarmatha National Park. The trail climbs steadily with your first views of Everest appearing above the ridgeline. Arrive at Namche, the bustling Sherpa capital and trading hub.",
        tags:['Sagarmatha National Park','First Everest views','Namche Bazaar'] },
      { day:4, route:'Acclimatisation in Namche', alt:3441, time:'rest day',
        desc:"Hike to the Everest View Hotel or Syangboche for panoramic views. Visit the Sherpa Museum and explore the local markets selling everything from yak cheese to trekking gear.",
        tags:['Acclimatisation','Everest View Hotel','Sherpa Museum'] },
      { day:5, route:'Namche → Dole', alt:4200, time:'5–6 hrs',
        desc:"Leave the main EBC trail and head toward Gokyo through rhododendron forests. Views of Ama Dablam and Kantega emerge as you climb.",
        tags:['Gokyo route','Rhododendron','Ama Dablam','Kantega'] },
      { day:6, route:'Dole → Machhermo', alt:4470, time:'4–5 hrs',
        desc:"Gradual ascent through alpine meadows with views of Cho Oyu (8,188m) growing larger ahead. The air thins noticeably at this altitude.",
        tags:['Alpine meadows','Cho Oyu','High altitude'] },
      { day:7, route:'Machhermo → Gokyo', alt:4790, time:'5–6 hrs',
        desc:"Walk alongside the massive Ngozumpa Glacier (Nepal's longest). Arrive at the third Gokyo Lake, its turquoise waters stunning against the grey glacial moraine.",
        tags:['Ngozumpa Glacier','Gokyo Lakes','Turquoise water'] },
      { day:8, route:'Gokyo Ri (5,357m) → Thangnak', alt:4700, time:'sunrise + 4 hrs',
        desc:"Early morning climb for a 360-degree Himalayan panorama: Everest, Lhotse, Makalu, Cho Oyu, and the turquoise Gokyo Lakes far below. One of the finest viewpoints in the Himalayas. Descend to Thangnak.",
        tags:['Gokyo Ri','360° panorama','Everest','Cho Oyu'] },
      { day:9, route:'Cho La Pass (5,368m) → Dzongla', alt:4830, time:'6–9 hrs',
        desc:"The trek's most technical day. Steep glacial traverse across Cho La Pass with potential ice and snow. Demanding but exhilarating, connecting the Gokyo and EBC valleys.",
        tags:['Cho La Pass','Glacial traverse','Technical','Ice & snow'] },
      { day:10, route:'Dzongla → Lobuche', alt:4910, time:'4–5 hrs',
        desc:"Rejoin the classic EBC trail. Pass the memorials for fallen climbers — a sobering and moving reminder of the mountain's power.",
        tags:['EBC trail','Climber memorials'] },
      { day:11, route:'Lobuche → Gorak Shep → EBC', alt:5365, time:'7–8 hrs',
        desc:"The day you've been waiting for. Trek through the Khumbu Icefall zone to stand at Everest Base Camp with the world's highest peak looming above. An emotional and unforgettable moment.",
        tags:['Everest Base Camp','Khumbu Icefall','Summit of journey'] },
      { day:12, route:'Kala Patthar (5,555m) → Pheriche', alt:4300, time:'full day',
        desc:"Pre-dawn hike to Kala Patthar for THE classic Everest sunrise view — the summit glowing gold in the first light. Then begin the long descent to Pheriche for well-earned rest.",
        tags:['Kala Patthar','Everest sunrise','Highest point'] },
      { day:13, route:'Pheriche → Namche Bazaar', alt:3441, time:'6–7 hrs',
        desc:"Retrace the route via Tengboche Monastery (the spiritual heart of the Khumbu), surrounded by Buddhist prayer flags and rhododendron forests.",
        tags:['Tengboche Monastery','Prayer flags','Rhododendron'] },
      { day:14, route:'Namche → Lukla', alt:2804, time:'6–7 hrs',
        desc:"Final descent with celebration alongside the trek crew. A day of reflection on everything you've accomplished.",
        tags:['Final descent','Celebration','Farewell'] },
      { day:15, route:'Fly Lukla → Kathmandu', alt:1400, time:'30 min flight',
        desc:"30-minute flight back to Kathmandu. Farewell dinner with your guide.",
        tags:['Return flight','Farewell dinner','Trek complete'] }
    ],
    pricing: [['1–2 pax', 800],['3–4 pax', 700],['5–6 pax', 650],['7+ pax', 600]]
  }
];

const INCLUDED = [
  'Airport pickup (private transport to your hotel)',
  'Ground transport to/from trek start and end',
  'Experienced English-speaking guide — salary, food, insurance, transport, lodging covered',
  'All required trekking permits',
  'Mountain teahouse / guesthouse accommodation on trek',
  'Equipment loan: sleeping bag, down jacket, trekking poles',
  'Emergency rescue coordination',
  'Government taxes and service charges',
  'First-aid kit carried by your guide'
];
const ADDONS = [
  ['Porter', '$25 per day', 'Carries your main pack. Ask for one when you book.'],
  ['Meals on the trail', '$25–30 per person per day', 'Paid at teahouses as you go, not to us.'],
  ['Extra days', 'Priced on request', 'Depends on the route and what you add to it.']
];
const NOT_INCLUDED = [
  'Meals on the trail — budget $25–30 per person per day, paid at teahouses',
  'Drinks, snacks, bar bills',
  'Hot showers, charging, Wi-Fi, heating at teahouses',
  'Travel insurance — mandatory, must cover high-altitude trekking and evacuation',
  'Personal trekking gear (boots, clothing, etc.)',
  'Costs from unforeseen events (weather, strikes, landslides, illness)',
  'Tips for guide and porters (customary in Nepal)'
];

const FAQS = [
  ['How fit do I need to be?',
   'For shorter low-altitude treks like Poon Hill, anyone in regular walking shape will do fine. For passes above 5,000 m, plan three to four months of cardio and a few long hikes back home with a loaded daypack. The honest answer: enthusiasm and steady walking matter more than raw athleticism — we walk slowly and steadily, every day.'],
  ['What about altitude sickness?',
   "Every itinerary above 4,000 m includes proper acclimatisation days. We walk slow, drink lots of water, and watch for symptoms together. I carry a first-aid kit and a pulse oximeter. If anyone shows signs of altitude sickness, descending is always the answer — we're never too proud to turn around."],
  ['Do I need travel insurance?',
   "Yes — it's mandatory. You need a policy that covers high-altitude trekking (check the altitude limit of your trek) and helicopter evacuation. World Nomads, Global Rescue, and SafetyWing are popular options."],
  ['What should I pack?',
   "Sturdy broken-in hiking boots, layered clothing (base layers, fleece, light down, waterproof shell), a 30–40 L daypack, sun protection, and a refillable water bottle. We loan you a sleeping bag, down jacket and poles, so leave those at home. I'll send a full packing list once you book."],
  ['Can I join as a solo trekker?',
   'Absolutely — a lot of our trekkers come solo. You get a private guide and your own room in teahouses where available. The 1-pax pricing covers it. Many solo travellers say the trip turned into the most social trip of their year.'],
  ['How do I get to Nepal — do I need a visa?',
   "Most visitors fly into Kathmandu (KTM) and get a visa-on-arrival at the airport: 30 days is around USD 50, 90 days around USD 125. Bring USD cash and a passport photo. I'll meet you at arrivals and drive you to your hotel — that's part of every package."],
  ['Are meals included?',
   "Meals aren't included so you can eat what you want, when you want. Teahouse menus are reasonable — budget around USD 25–35 per day for three meals plus tea. Your guide eats separately (covered)."],
  ['What is the best time to trek in Nepal?',
   "Two main seasons: Spring (March–May) brings warmer days, blooming rhododendrons, and good visibility. Autumn (September–November) has the clearest skies of the year and stable weather. Winter is possible on lower treks; the monsoon (June–August) is generally avoided except for rain-shadow regions like Upper Mustang."]
];

/* ============ TREK CARDS ============ */
const grid = document.getElementById('trekGrid');
const diffMap = { 'easy':'easy', 'moderate':'moderate', 'challenging':'challenging', 'strenuous':'strenuous' };

function trekDuration(days) {
  if (days <= 5) return 'short';
  if (days <= 10) return 'medium';
  return 'long';
}

TREKS.forEach((t, i) => {
  const card = document.createElement('article');
  card.className = 'trek-card reveal';
  card.dataset.difficulty = t.diffKey;
  card.dataset.length = trekDuration(t.days);
  card.dataset.id = t.id;
  card.style.transitionDelay = (i * 60) + 'ms';
  card.innerHTML = `
    <div class="trek-card-media">
      <span class="diff-badge" data-d="${t.diffKey}">${t.difficulty}</span>
      <img loading="lazy" src="${t.image}" alt="${t.name} trek scenery">
    </div>
    <div class="trek-card-body">
      <div style="font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:var(--ink-500);">${t.region}</div>
      <h3>${t.name}</h3>
      <div class="trek-meta">
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>${t.days} days</span>
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20l5-9 4 6 3-4 6 7H3z"/></svg>${t.altitude}</span>
      </div>
      <div class="trek-card-foot">
        <div class="trek-price"><small>From</small><b>$${t.fromPrice}</b><small style="text-transform:none; letter-spacing:0; font-size:11px; color:var(--ink-500); margin-top:2px;">per person</small></div>
        <span class="trek-card-link">View details
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </span>
      </div>
    </div>`;
  card.addEventListener('click', () => openModal(t.id));
  grid.appendChild(card);
});

/* ============ FILTERS ============ */
let activeDiff = 'all', activeLen = 'all';
