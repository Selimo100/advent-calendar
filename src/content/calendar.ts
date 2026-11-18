/**
 * YOUR CALENDAR. This file is the single source of truth for all content.
 *
 * Every personal detail is currently a visible placeholder such as Joya or
 * [YOUR MEMORY]. Replace the placeholders with your real texts, put photos in
 * public/media/photos/ and voice recordings in public/media/audio/, and run
 * `npm run content:validate` to check everything.
 *
 * IMPORTANT: everything in this file and in public/media/ is part of the
 * public, static website after deployment. Anyone with the URL can read it.
 * Only put things here that you are comfortable shipping that way.
 *
 * Text rules: standard German, "ss" instead of the sharp s, plain text with
 * optional **bold** and *italic*. Dates in `date` fields use YYYY-MM-DD and
 * are shown as DD.MM.YYYY.
 */
import { defineCalendar } from "./schema.ts";

export default defineCalendar({
  calendarId: "advent-2026",
  year: 2026,
  settings: {
    recipientName: "Joya",
    senderName: "Selina <3",
    title: "24 chlini Gründ, wieso du mir wichtig bisch",
    greeting: "Heyyy Amore mio",
    intro:
      "I dem chline Dorf wartet jede Tag im Dezember es neus Tüürli uf dich. Jedes verzählt es bizzli meh, warum du mir so unglaublich wichtig bisch.",
    signature: "Vo Herze, Selina <3",
    closingMessage:
      "D Adventsziit isch verbi, aber d’Tüürli, wo du ufgmacht hesch, die bliibet für immer und es sind no so viel meh als nur die 24, glaub mir. Danke, dass du dir jede einzelni Tag en Moment gnoh hesch.",
    footerNote: "Gmacht mit viel Liebi.",
  },
  doors: [
    {
      day: 1,
      title: "Willkomme im Dorf",
      blocks: [
        {
          type: "letter",
          title: "Liebi Joya",
          paragraphs: [
            "hüt machsch du s erste Tüürli uf. Ich han mir überleit, wie ich dir im Dezember jede Tag e chlini Freud chönnti bereite und genau det drus isch das chline Dörfli entstande. (Es isch sogar no chliner als Breiti hehe)",
            "Hinter jedem Tüürli steckt öppis, was ich dir scho lang han wele säge oder nie z Viel säge chan: e Errinerig e chlini Ihladig und no viel meh wo du im Dezember gseh wirsch. Han mich für ein chline digitale Adventskalender entschiede, will ich d Begeisterig vo dir gseh han, wo ich dir mini Websiite zeigt han, was mich so erfüllt het, dass ich denkt han das wär doch grad mal e gueti Möglichkeit.",
            "Jede Tag chunnt es neus Tüürli dezue. Die wo scho offe sind, bliibet da und du chasch sie so oft du willsch wieder ufmache und lese.",
          ],
          signature: "Selina <3",
        },
      ],
    },
    {
      day: 2,
      title: "Öppis wo ich a dir schetze",
      blocks: [
        {
          type: "letter",
          paragraphs: [
            "Mir isch letzti ufgfalle, wie gnau du mir zuelosisch, egal was ich säge. Du merksch dir jedi Chlinigkeit au wenn du mir mal gseit hesch, dass es dir nöd so eifach fallt. Es isch so es schöns Gfühl z merke, dass dir öppert zuelosst und sich defür interessiersch was du wie seisch. Das min Hals mini Schwachstell isch hesch durch das au scho sehr usgnutzt hihihi",
          ],
          signature: "Selina <3",
        },
      ],
    },
    {
      day: 3,
      title: "Es Lied vo eus",
      blocks: [
        {
          type: "song",
          trackTitle: "Dove e quando",
          artist: "Benji & Fede",
          spotifyUrl:
            "https://open.spotify.com/track/5XM7tx8ovQ9UrYqUowW1AK?si=82234e595c644072",
          artwork: {
            src: "/media/photos/song1.png",
            alt: "Dove e quando - Benji & Fede",
          },
          intro: ["Das Lied bringt mir immer es Lächle is gsicht."],
          whyItRemindsUs: [
            "S erste mal wo ich gseh han, dass du das Lied au losisch han ich mega müsse lache. I dere Shared-Playlist vo Spotify wo eusi Musig Gschmäcker vermischt het. Finds immer so lustig, wie das Lied eifach alli kennet und mitsinget, aber nonie würklich no nie han ich erlebt, dass das öppert wo nöd Italienisch chan eifach so guet singt. Ich mein das im volle Ernst. Klar weisch viellicht nöd was es heisst oder die perfekti betonig (Cellulaaare) haha aber ich schwör es tönt sooo guet. Muss immer schmunzle. Nie wird ich das vergässe, wie mir bi mir gsie sind und ich i dini Auge gluegt han und du lossingsch. Das isch eine vo mine Lieblings Moment.",
          ],
        },
      ],
    },
    {
      day: 4,
      title: "En gmeinsame Moment",
      blocks: [
        {
          type: "memory",
          title: "Euse ersti Kuss",
          photos: [
            {
              src: "/media/photos/lily.png",
              alt: "The lily",
            },
          ],
          date: "2026-10-30",
          location: "Bodenacherstrasse 12c, 8303 Bassersdorf",
          story: [
            "Mis Herz het so schnell gschlage, dass ich mich fast nöd han chöne zämerisse. De Film isch für mich vo ahfang ah öppis näbe sächlichs gsie. Han ich d Message vom Film schön gfunde. Absolut. The Lily means: I dear you to love me... Du uf minere Brust am ligge. Ich hetti dir det no so viel länger eifach id d Auge chöne luege. Han us nervosität d Intensivität immer wieder ufbroche hahaha. Aber han dich nöd wele stresse, will ich selber gmerkt han dass alles so schnell passiert. Ich hetti ja demit ufghört aber alles fühlt sich so guet und richtig ah. Nachdem ich es wieder unterbroche han mit erere wiitere Umarmig, bewegsch du dis Gsicht ganz wenig immer wiiter zu mir und denn s Füürwärch. No NIE han ich so öppis gfühlt. Ich han i dem Moment nöd gwüsst, was nochene chunnt aber bin mir so sicher gsie, dass das richtig sie muess.",
            "Ab dem erste Kuss han ich nüme wele ufhöre dini Perfekte Lippe z küsse. Dich nie wieder gah z'lah das isch ganz klar gsie.",
          ],
        },
      ],
    },
    {
      day: 5,
      title: "En chliine Guetschii",
      blocks: [
        {
          type: "voucher",
          title: "En Abig, wo ich ussuech",
          description:
            "Ich entscheide, was mir machet. Ich kümmere mich um alles, was du willst.",
          conditions: [
            "Ihlösbar amene abig vo dinere Wahl",
            "Ich derf nie sege, dass du entscheide söllsch",
            "Du derfsch Ihspruch erhebe, wenns dir nöd passt natürlich",
          ],
          note: "Eigentlich han ich en Abig wo du ussuechsch wele mache, sprich das isch das was anderi mache würdet. Aber mir sind nöd so anderi und will mir beidi entscheide hasset machemer das halt so ume.",
        },
      ],
    },
    {
      // Door 6: the Samichlaus mission. The `blocks` below are the reward and
      // stay hidden in the interface until the game has been finished once.
      day: 6,
      title: "E chlini Mission",
      game: {
        intro: [
          "Heute wartet eine kleine Mission auf dich. Hilf dem Samichlaus durch den verschneiten Winterwald.",
          "Am Ziel wartet eine Nachricht nur für dich.",
        ],
        startLabel: "Mission starten",
        victoryText:
          "Du hast es geschafft! Der Samichlaus hat seine Lieferung abgegeben. Diese kleine Nachricht ist nur für dich.",
      },
      blocks: [
        {
          type: "letter",
          title: "Heyyy, du hesch es gschaft.",
          paragraphs: [
            "Wowyyyyy. Okay isch jetzt nöd soo deep gsie hahaha aber anyways.",
            "Danke, dass du em Samichlaus ghulfe hesch.",
          ],
          signature: "Selina <3",
        },
        {
          type: "voucher",
          title: "Es chlines Gschänckli für dich",
          description: "Abhol parat bi mir.",
          note: "Da du dich jetzt als echti Pro-Gamerin herusgstellt hesch, bechunsch, wenn mir eus s nächste mal gsehn en chline Priis vo mir hehe. Mal luege, öb du det genau so guet drin bisch. (Han gar kei Zwiifel)",
        },
      ],
    },
    {
      day: 7,
      title: "Drüü chlini Gründ",
      blocks: [
        {
          type: "reasons",
          title: "Drüü Sache, wo min Tag besser machet",
          intro: "Ganz unspektakulär und genau deswege wichtig:",
          reasons: [
            "Dis Lächle",
            "Das du immer nahfrögsch wie es mir gaht und es guet oder oke nöd akzeptiersch. Du bestahsch durff das ich verzehle was soo schön isch.",
            "Whatsapp eifach Videos nach em schaffe oder de Schuel",
          ],
        },
      ],
    },
    {
      day: 8,
      title: "Winterluft",
      blocks: [
        {
          type: "activity",
          title: "E chlini Winterufgab für dich",
          invitation: [
            "Wenn du hüt usegasch: Mach es Foti vo öppis Winterlichem, was dich zum Lächle bringt.",
            "Du musch es niemertem zeige. Aber ich würd mich natürlich freue hehe",
          ],
          ideas: [
            "Es Liecht i de Dämmerig",
            "Schneeball öppertem id Frässi hahaha",
          ],
        },
      ],
    },
    {
      day: 9,
      title: "Nomal es Lied",
      blocks: [
        {
          type: "song",
          trackTitle: "Bad Liar",
          artist: "Anna Hamilton, The Acoustic Room",
          spotifyUrl:
            "https://open.spotify.com/track/0X9MxHR1rTkEHDjp95F2OO?si=c17d255d605a46f9",
          whyItRemindsUs: [
            "Ach hahaha das Lied. Schrecklich minere Meinig nach. Aber jedesmal wenn ich die Playlist lose (was eigentlich immer isch) und das Lied ufchunnt muss ich sooo lache. Naja die Version isch wük nöd mies, aber für dich würd ich mir das Lied uf durschleife ine zieh, wenn es dich glücklich mache würd. Und ja es isch scho schön aber s Original immerno besser hehe",
          ],
        },
      ],
    },
    {
      day: 10,
      title: "Weisch no?",
      blocks: [
        {
          type: "memory",
          title: "De Moment, wo du mir es Lächle ins Gsicht zauberet hesch",
          videos: [
            {
              src: "/media/videos/Oktoberfest.mp4",
              alt: "Oktoberfest",
            },
          ],
          dateLabel: "24.10.2026",
          story: [
            "Ich i dem Dirndel hahaha. Ich wird mich nie demit ahfründe chöne. Aber du hesch mir so viel Kompliment gmacht und mich so supported ih allem. Das han ich so enorm gschetzt du weisch nöd. Wie du mir zuegluegt hesch und all eusi Gspröch, wird ich nie vergässe. Eventuell isch mir ganz klar gsie, was weli Siite vo de Masche vom Dirndel heisst. Han ich viellicht extra dich Google lah. Man Munkelt hehe. Aber wo du mir die Schleife nochene rechts bindisch und ich dir ghöre dörf au wenns nur für de Abig det zu mals gsie isch. Das Lache isch mir nüme us em Gsicht sit det ah. Und vergessemer de Choker nöd... Wildi fantasie hesch du mir det erweckt.",
          ],
        },
      ],
    },
    {
      day: 11,
      title: "Es Bild mit erere Gschicht",
      blocks: [
        {
          type: "memory",
          photos: [
            {
              src: "/media/photos/eyes.jpeg",
              alt: "Eyes",
              caption: "Eusi Auge",
            },
          ],
          location: "Assisi, Italie 11-16.10.2026",
          story: [
            "Ich weiss nöd öb es dir ufgfalle isch, aber han im Lager so oft soooo tüüf i dini Auge gluegt und dir Kompliment für dini Auge gmacht. Sie hend mich würklich eifach fasziniert und hans Gfühl gha die hend no so viel z'verzehle. Ich will alles usefinde was dehinter steckt. Jetzt bin ich am Punkt wo ich die Möglichkeit han und wow... Bin parat für alles was no chunnt und chans chum abwarte die Auge no Stunde und Jahre lang z'betrachte.",
          ],
        },
      ],
    },
    {
      day: 12,
      title: "E Ihladig für dich",
      blocks: [
        {
          type: "activity",
          title: "En gmüetliche Abig zäme",
          invitation: [
            "Ich lade dich zumene Abig bi mir ih. Mir müend nüt mache. Decki, Cherze, öppis Warms zum trinke.",
            "Du bringsch nur dich mit.",
          ],
          note: "Han mal so de 19 uf de 20ti im Chopf gha, will am 20te gömmer ja denn zäme an Wiehnachtsmärt. Aber chömmer denn no luege je nach dem.",
        },
      ],
    },
    {
      day: 13,
      title: "E Nachricht zum lose",
      blocks: [
        {
          type: "voice",
          title: "Für dich ufgnoh",
          intro: [
            "Hüt mal echli anderst",
          ],
          audio: { src: "/media/audio/Joya_Calendar_audio.m4a" },
          durationLabel: "0:50",
          transcript: [
            "Hallo, mein Schatz.",
            "Heute ist schon der 13. Dezember und für heute habe ich mir gedacht, dass ich dir eine kleine Sprachnachricht hinterlasse, weil du ja immer sagst, wie sehr du es magst, wenn ich Italienisch spreche.",
            "Ja, genau.",
            "Ich wollte dir einfach sagen, wie dankbar und wie unglaublich glücklich ich bin, dich dieses Jahr kennengelernt zu haben.",
            "Mir fehlen die Worte für all das.",
            "Ich hoffe, dass dir mein Adventskalender bis jetzt gefällt. Und ich denke, dass noch ein paar schöne Kleinigkeiten auf dich warten, die dir ein Lächeln ins Gesicht zaubern werden.",
          ],
        },
      ],
    },
    {
      day: 14,
      title: "Es wahrs Lied",
      blocks: [
        {
          type: "song",
          trackTitle: "we fell in love in october",
          artist: "girl in red",
          spotifyUrl:
            "https://open.spotify.com/track/6IPwKM3fUUzlElbvKw2sKl?si=0307fd9be0f948fb",
          artwork: {
            src: "/media/photos/song3.png",
            alt: "we fell in love in october - girl in red",
          },
          intro: ["Das Lied chönnti nöd wahrer sii."],
          whyItRemindsUs: [
            "Was isch d Chance, dass das passiert. Im Oktober richtig kenneglernt und det gwüsst: You will be my world. Und jetzt simmer im Dezember und ich chönnti mir nöd sicherer sii. Und jedi Ziile wo sie singt unterschriib ich zu 100%. Hehe und girl in red eh e queen. Props nomal ad Laura für de Wingwoman move mit I wanna be your girlfriend hehe.",
          ],
        },
      ],
    },
    {
      day: 15,
      title: "Es ganz chlises Gschänckli",
      blocks: [
        {
          type: "voucher",
          title: "Es ganz chlises Gschänckli",
          description: "Du derfsch jetzt dis chline Päckli ufmache.",
          note: "Es isch nüt grosses, aber finds mega herzig. Du chasch dir ussueche weles und denn mir s andere gäh. Hihihi",
        },
      ],
    },
    {
      day: 16,
      title: "En Wunsch für spöter",
      blocks: [
        {
          type: "letter",
          title: "Irgendwänn will ich mit dir …",
          paragraphs: [
            "Irgendwänn will ich mit dir ih e Stadt reise, wo mir no nie gsie sind und die entdecke. Zäme i Restis gah wo mir nöd kännet und det neus gseh und usprobiere.",
            "Irgendwänn will ich mit dir an es Konzert gah und dir zeige, wie ich ufgahn wenn ich Musig ghöre vo mine lieblings Künstler und gseh wie du singsch und alles us dinere Lunge use schreisch.",
          ],
        },
      ],
    },
    {
      day: 17,
      title: "S erste Lied",
      blocks: [
        {
          type: "song",
          trackTitle: "Prada",
          artist: "RAYE, Cassö, D-Block Europe",
          spotifyUrl:
            "https://open.spotify.com/track/59NraMJsLaMCVtwXTSia8i?si=7ca66e8aee4a4ad0",
          intro: ["Das Lied het e ganz spezielli Bedütig."],
          whyItRemindsUs: [
            "Wo mir in Assisi gsie sind und du i mim Ämtli Team gsie bisch han ich mich natürlich gfreut hehe. Aber wo mir so produktiv i de Chuchi gsie sind han ich dich gfrögt, öb du hesch wele Musig laufe lah und du hesch denn genau Prada laufe lah und bisch schockiert gsie, dass ich das Lied kenne.",
          ],
        },
      ],
    },
    {
      day: 18,
      title: "En churze Brief",
      blocks: [
        {
          type: "letter",
          paragraphs: [
            "Also ich probier mich churz z'hebe, wird schwierig but I'll try.",
            "Früehner han ich nie a Teenage Love glaubt, han dir das glaub scho öfters gseit. Han nie verstande, wie Lüüt so sicher sii chönd. Aber sit du i mis Lebe trette bisch het sich mini Meinig um 180 grad gkehrt. Ich will gar nüt da sege. Egal was in Zuekunft cho wird, weiss ich dass ich jedi Sekunde gnüsse wird. Mer weiss nähmlich nie wenn es die letzti isch. Leider han ich das das Jahr au wieder uf die herti Tour müsse lerne. Deswege jedi Sekunde, jede Hunderstel gnüsse und s'Beste drus mache. Us jedere Situation.",
            "Will ich mich echli chürzer ghalte han, derfsch du gern no s chline Gschänckli 18 Ufmache vo de Box"
          ],
          signature: "Selina <3",
        },
      ],
    },
    {
      day: 19,
      title: "E chlini Challenge",
      blocks: [
        {
          type: "activity",
          title: "Wer findet s schönste Wiehachtsliecht?",
          invitation: [
            "Hüt suechemer beidi unabhängig vonenand s'schönste Wiehnachtsliecht i eusere Umgebig.",
            "Am Abig vergliichemer.",
            "Schriib mer bitte schnell, damit ich weiss, dass es hüt isch haha",
          ],
        },
      ],
    },
    {
      day: 20,
      title: "E Lieblingserrinerig",
      blocks: [
        {
          type: "memory",
          photos: [
            {
              src: "/media/photos/memory1.jpeg",
              alt: "Zoe",
            },
            {
              src: "/media/photos/memory2.jpeg",
              alt: "Spiegel",
            },
            {
              src: "/media/photos/memory3.jpeg",
              alt: "Mir",
            },
          ],
          date: "2026-11-14",
          location: "Dietlikon, Bassersdorf, Breite b'Nürensdorf, Seen",
          story: [
            "De Tag wird für mich unvergässlich bliibe. I de Theorie wär das euses erste Träffe gsie nach Assisi, hettemer eus nöd vorher nomal troffe. Also bessergseit es wär am Fritig gsie but anyways. Ich han mich soo enorm uf de Tag gfreut, will ich gwüsst han, dass de Tag allei eus ghört. Mir sind am Morge bi Ziite uf de Bus richtig Dietlike (nöd richtig Flughafe det wo s'Schiff fahrt in Meer vo de Schwiiz). Als erstes sind mir in BabyOne und mis Herz isch det eifach nur ufgange. Ich hans soo herzig gfunde, wie du öppis chlises für d'Nele usgsuecht hesch. Euse Zweiti Stop isch den im Ikea gsie. Wie du jetzt ja weisch, lieb ich de Ikea. Um ehrlich z'sii han ich mir scho vorgstellt, wie mir denn eventuell mal für e zuekünftigi Wohnig im Ikea gönd go poste und eus für Möbel und Deko entscheidet, au wenn du das ja nöd so gern machsch, würd ich jedi Sekunde devo mit dir gnüsse. Denn eusi Hauptmission vom Tag: s'Gschänck für d'Zoe. Im Jumbo simmer leider nöd so erfolgriich gsie, will er im Umbau gsie isch und leider das Fass nüme gha het. Mir sind wiiter in Ottos wo mer natürlich au chli Alk händ müsse poste. Denn wieder in Jumbo um e Schachtle z'poste hahaha. Und als letzts simmer denn no in Coop zum alles abschlüsse und abrunde. Mir hend eus nochene dezue entschiede, dass mir no schnell zu mir gönd, um es paar Bilder uszdrucke zum uf d'Box chläbe. Det hemmer au eusi erste richtigi Bilder zäme gmacht. Eis hesch du sogar als Polaroid i dini Handyhülle tah, da isch mis Herz grad no meh ufgange. Und han mich nöd chöne zrugg hebe wo du die Bilder am ussueche gsie bisch. Chan mini Händ würklich nöd vo dir lah und am liebste hetti ich dich i jedem Moment vom Tag bi mir. Mir sind denn au no churz bi dir in Breiti verbii, wo ich endlich d'Laura kenneglernt han, au wenn es nur churz gsie isch han ich mich bi dine Familie direkt willkomme gfühlt, was unbeschrieblich isch. Wow denn chömemer fast zumene Highlight vom Tag. Dis Chleid für d'Firmig. Wo du das go ahprobiere bisch und nochene usecho bisch, bin ich eifach sprachlos gsie. Ich han nöd gwüsst was sege (viellicht hett mer das bemerkt haha). Du hesch perfekt usgseh! Zum das ganze no abschlüsse simmer no zu dine Mom ihre no go Hoi säge. Han dini ganzi Familie a dem Tag kenneglernt hihihi so toll. So liebi Mensche.",
            "Ich han a dem Tag so viel chlini Sache über dich glernt. Zum Biispiel, dass du nur mit Bargeld zahlsch, um dis Geld nöd unnötig ih Onlineshops uszgseh ;)",
            "Unvergesslich für mich. Es het sich sooo normal ahgfühlt und isch en ganz normale Alltag gsie, wie er in Zuekunft chönnit usgseh, ohni irgendöppis extra müsse mache. Eifach zäme das mache, was mer eh erledige muss in guete Begleitig.",
          ],
        },
      ],
    },
    {
      day: 21,
      title: "Uf was ich mich freue",
      blocks: [
        {
          type: "reasons",
          title: "Sache, uf die ich mich mit dir freue",
          reasons: [
            "Gmeinsami Ferie",
            "Öfters i dine Ärm chöne ufwache",
            "Euse Neujahreskuss",
            "Gmeinsami Errinerige sammle",
          ],
        },
        {
          type: "voucher",
          title: "En Abigsspaziergang",
          description: "Wenn du willsch, Lust und Ziit hesch.",
        },
      ],
    },
    {
      day: 22,
      title: "En chline Brief mit Bilder",
      blocks: [
        {
          type: "memory",
          photos: [
            {
              src: "/media/photos/img1.png",
              alt: "Selfie im wiisse T-Shirt mit Herzchettli",
            },
            {
              src: "/media/photos/img2.png",
              alt: "Selfie im Minion-Kostüm",
            },
          ],
          story: [
            "Ich lieb das Bild. Ein Tag nach em Lager isch das gsie und ab dem Moment hesch du mir de Chopf nur no meh verdreht. Ich han nöd gwüsst a was ich bi dir drah bin aber läck bin ich scho verschosse gsie hahaha. Unglaublich. Ich bin direkt mit de Ronja schnell use und han ihre alles verzehlt. Mini Gedanke a dem Abig sind nöd ganz so schön gsie, wegem andere Ereigniss wo vorgfalle isch... aber du hesch mich grad ufgmunteret. Und nomal WOW das Bild. Ich liebs.",
          ],
        },
      ],
    },
    {
      day: 23,
      title: "Morn isch es so wiit",
      blocks: [
        {
          type: "letter",
          paragraphs: [
            "Nur no einmal schlafe. S letzte Tüürli isch s grösste im ganze Dörfli.",
            "Ich will dich gar nöd spoilere, aber ich bin mir sicher, dass du dich sehr freue würsch. Ich bin nöd würklich en Materielle Mensch, ich glaub das hesch mitlerwille au scho mitbecho hihi. Aber es isch öppis vo ganzem Herze...",
          ],
        },
      ],
    },
    {
      day: 24,
      title: "S'letzte Tüürli",
      blocks: [
        {
          type: "finalLetter",
          title: "Liebi Joya",
          paragraphs: [
            "Ich hoff, dass du dich über die chlini Geste vo mir gfreut hesch und mindestens eis chlises Lächle im Gsicht gha hesch. Ich han mir Müeh geh, au wenns nöd viel gsie isch, isch es für mich au so schön gsie das allei z'vorbereite. Nomal genau durchdänke, was ich zum Bild oder zum Lied fühlt han und was ich dir dezue säge han wele. Es isch würklich vo Herze cho <3",
            "Danke für jede Tag im Dezember, wo du dir d'Ziit gnoh hesch die Tüürli z'öffne. Das isch nöd selbstverständlich.",
          ],
          finalSurprise: {
            title: "Und no öppis",
            paragraphs: [
              "Du derfsch jetzt s chline Gschänckli wo ich verpackt han ufmache. Ich han eifach probiert alles was ich zu dem Ziitpunkt gfühlt gha han irgendwie ih Wort z'fasse i de Hoffnig, dass es irgendwenn mal e schöni Errinerig wird an Ahfang. Und tuet mer leid, dass es nüme so aktiv gschriebe worde isch, defür isch det würklich de ganzi Ahfang drin.",
            ],
          },
          signature: "Selina <3",
        },
      ],
    },
  ],
});
